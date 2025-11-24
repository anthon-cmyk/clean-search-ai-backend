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

  async getAccessibleAccounts(
    refreshToken: string,
  ): Promise<IGoogleAdsAccount[]> {
    const client = this.getClient();

    const accessible = await client.listAccessibleCustomers(refreshToken);
    const resourceNames = accessible.resource_names ?? [];
    if (!resourceNames.length) return [];

    // Pass 1: fetch metadata about every accessible customer
    const metas = await Promise.all(
      resourceNames.map(async (resourceName) => {
        const customerId = resourceName.split('/')[1];

        try {
          const customerClient = client.Customer({
            customer_id: customerId,
            refresh_token: refreshToken,
            login_customer_id: customerId, // safe for metadata query
          });

          const [row] = await customerClient.query(`
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

          const c = row?.customer;
          if (!c?.id) return null;

          return {
            customerId: c.id.toString(),
            descriptiveName: c.descriptive_name || 'Unnamed',
            customerName: c.descriptive_name || 'Unnamed',
            currencyCode: c.currency_code || 'USD',
            timeZone: c.time_zone || 'UTC',
            isManagerAccount: !!c.manager,
          };
        } catch (e) {
          this.logger.error(`Failed metadata for ${customerId}`, e);
          return null;
        }
      }),
    );

    const customers = metas.filter(Boolean) as Array<{
      customerId: string;
      descriptiveName: string;
      customerName: string;
      currencyCode: string;
      timeZone: string;
      isManagerAccount: boolean;
    }>;

    // Identify manager IDs the user can access
    const managerIds = customers
      .filter((c) => c.isManagerAccount)
      .map((c) => c.customerId);

    // MVP rule: pick a single manager ID to act as login_customer_id
    // If user has multiple MCCs, UI can later allow selection.
    const fallbackManagerId = managerIds[0] ?? null;

    // Pass 2: attach loginCustomerId + managerCustomerId
    return customers.map((c) => {
      const loginCustomerId = c.isManagerAccount
        ? c.customerId
        : (fallbackManagerId ?? c.customerId);

      return {
        customerId: c.customerId,
        customerName: c.customerName,
        descriptiveName: c.descriptiveName,
        currencyCode: c.currencyCode,
        timeZone: c.timeZone,
        isManagerAccount: c.isManagerAccount,
        canManageClients: c.isManagerAccount,

        loginCustomerId,
        managerCustomerId: c.isManagerAccount ? null : fallbackManagerId,
      };
    });
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
   * @param campaignId - Optional campaign ID to filter results
   * @param adGroupId - Optional ad group ID to filter results
   * @returns Array of search term records with campaign/adgroup/keyword data
   */
  async fetchSearchTerms(
    customerId: string,
    loginCustomerId: string,
    refreshToken: string,
    startDate: string,
    endDate: string,
    campaignId?: string,
    adGroupId?: string,
  ): Promise<IGoogleAdsSearchTerm[]> {
    this.validateDateRange(startDate, endDate);

    const client = this.getClient();

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
      login_customer_id: loginCustomerId,
    });

    const whereConditions = [
      `segments.date BETWEEN '${startDate}' AND '${endDate}'`,
      `campaign.status = 'ENABLED'`,
      `ad_group.status = 'ENABLED'`,
    ];

    if (campaignId) {
      whereConditions.push(`campaign.id = ${campaignId}`);
    }

    if (adGroupId) {
      whereConditions.push(`ad_group.id = ${adGroupId}`);
    }

    const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      search_term_view.search_term,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM search_term_view
    WHERE ${whereConditions.join(' AND ')}
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
          matchType:
            (row.ad_group_criterion?.keyword?.match_type as string) || '',
          metrics: {
            impressions: row.metrics?.impressions || 0,
            clicks: row.metrics?.clicks || 0,
            cost: (row.metrics?.cost_micros || 0) / 1_000_000,
            conversions: row.metrics?.conversions || 0,
            conversionsValue: row.metrics?.conversions_value || 0,
          },
        });
      }

      const filterDesc = campaignId
        ? `for campaign ${campaignId}`
        : 'across all campaigns';

      this.logger.log(
        `Fetched ${searchTerms.length} search terms ${filterDesc} for customer ${customerId} from ${startDate} to ${endDate}`,
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
