import { Injectable, Logger } from '@nestjs/common';
import { GoogleAdsApi } from 'google-ads-api';
import { ConfigService } from '@nestjs/config';
import {
  IGoogleAdsAccount,
  IGoogleAdsSearchTerm,
} from './interfaces/google-ads.interface';

@Injectable()
export class GoogleAdsService {
  private readonly logger = new Logger(GoogleAdsService.name);

  constructor(private configService: ConfigService) {}

  private getClient(): GoogleAdsApi {
    return new GoogleAdsApi({
      client_id: this.configService.get('GOOGLE_CLIENT_ID')!,
      client_secret: this.configService.get('GOOGLE_CLIENT_SECRET')!,
      developer_token: this.configService.get('GOOGLE_ADS_DEVELOPER_TOKEN')!,
    });
  }

  /**
   * Fetches all accessible Google Ads accounts for authenticated user.
   * Handles both direct accounts and accounts accessible through Manager (MCC) accounts.
   *
   * @param refreshToken - OAuth refresh token for authentication
   * @returns Array of accessible Google Ads customer accounts with metadata
   */
  async getAccessibleAccounts(
    refreshToken: string,
  ): Promise<IGoogleAdsAccount[]> {
    const client = this.getClient();

    try {
      const accessibleCustomers =
        await client.listAccessibleCustomers(refreshToken);

      if (!accessibleCustomers.resource_names?.length) {
        this.logger.warn('No accessible Google Ads accounts found');
        return [];
      }

      const accounts: IGoogleAdsAccount[] = [];

      for (const resourceName of accessibleCustomers.resource_names) {
        const customerId = resourceName.split('/')[1];

        try {
          const customerClient = client.Customer({
            customer_id: customerId,
            refresh_token: refreshToken,
            login_customer_id: customerId,
          });

          const results = await customerClient.query(`
            SELECT
              customer.id,
              customer.descriptive_name,
              customer.currency_code,
              customer.time_zone,
              customer.manager,
              customer.test_account
            FROM customer
            WHERE customer.id = ${customerId}
            LIMIT 1
          `);

          if (!results.length || !results[0].customer) {
            this.logger.warn(
              `No customer data returned for customer ID: ${customerId}`,
            );
            continue;
          }

          const customerData = results[0];

          if (!customerData.customer?.id) {
            this.logger.warn(
              `Customer ID missing in response for: ${customerId}`,
            );
            continue;
          }

          accounts.push({
            customerId: customerData.customer.id.toString(),
            customerName: customerData.customer.descriptive_name || 'Unnamed',
            descriptiveName:
              customerData.customer.descriptive_name || 'Unnamed',
            currencyCode: customerData.customer.currency_code || 'USD',
            timeZone: customerData.customer.time_zone || 'UTC',
            isManagerAccount: customerData.customer.manager || false,
            canManageClients: customerData.customer.manager || false,
          });

          this.logger.log(
            `Fetched account: ${customerId} - ${customerData.customer.descriptive_name || 'Unnamed'}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to fetch details for customer ${customerId}`,
            error,
          );
        }
      }

      return accounts;
    } catch (error) {
      this.logger.error('Failed to fetch accessible accounts', error);
      throw error;
    }
  }

  /**
   * Fetches search terms data from Google Ads for specified date range.
   * This retrieves the actual search queries users typed that triggered your ads.
   *
   * @param customerId - Google Ads customer ID (without hyphens)
   * @param loginCustomerId - Login customer ID (for MCC accounts, use manager ID)
   * @param refreshToken - OAuth refresh token
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @returns Array of search term records with campaign/adgroup/keyword data
   */
  async fetchSearchTerms(
    customerId: string,
    loginCustomerId: string,
    refreshToken: string,
    startDate: string,
    endDate: string,
  ): Promise<IGoogleAdsSearchTerm[]> {
    this.validateDateRange(startDate, endDate);

    const client = this.getClient();

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
      login_customer_id: loginCustomerId,
    });

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        ad_group.id,
        ad_group.name,
        search_term_view.search_term,
        ad_group_criterion.keyword.text,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions
      FROM search_term_view
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
        AND campaign.status = 'ENABLED'
        AND ad_group.status = 'ENABLED'
      ORDER BY metrics.impressions DESC
      LIMIT 10000
    `;

    try {
      const results = await customer.query(query);

      const searchTerms: IGoogleAdsSearchTerm[] = [];

      for (const row of results) {
        if (
          !row.campaign ||
          !row.campaign.id ||
          !row.ad_group ||
          !row.ad_group.id ||
          !row.search_term_view
        ) {
          this.logger.warn(
            `Skipping row with missing required data: ${JSON.stringify(row)}`,
          );
          continue;
        }

        searchTerms.push({
          campaignId: row.campaign.id.toString(),
          campaignName: row.campaign.name || 'Unknown Campaign',
          adGroupId: row.ad_group.id.toString(),
          adGroupName: row.ad_group.name || 'Unknown Ad Group',
          searchTerm: row.search_term_view.search_term || '',
          keyword: row.ad_group_criterion?.keyword?.text || '',
          metrics: {
            impressions: row.metrics?.impressions || 0,
            clicks: row.metrics?.clicks || 0,
            cost: (row.metrics?.cost_micros || 0) / 1_000_000,
            conversions: row.metrics?.conversions || 0,
          },
        });
      }

      this.logger.log(
        `Fetched ${searchTerms.length} search terms for customer ${customerId} from ${startDate} to ${endDate}`,
      );

      return searchTerms;
    } catch (error) {
      this.logger.error(
        `Failed to fetch search terms for customer ${customerId}`,
        error,
      );
      throw error;
    }
  }

  private isValidDateFormat(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;

    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }

  validateDateRange(startDate: string, endDate: string): void {
    if (!this.isValidDateFormat(startDate)) {
      throw new Error(`Invalid start date format: ${startDate}`);
    }

    if (!this.isValidDateFormat(endDate)) {
      throw new Error(`Invalid end date format: ${endDate}`);
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }

    if (end > today) {
      throw new Error('End date cannot be in the future');
    }
  }
}
