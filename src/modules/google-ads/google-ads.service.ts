import { Injectable, Logger } from '@nestjs/common';
import { GoogleAdsApi } from 'google-ads-api';
import { ConfigService } from '@nestjs/config';
import {
  IGoogleAdsAccount,
  IGoogleAdsAdGroup,
  IGoogleAdsCampaign,
  IGoogleAdsKeyword,
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

  /**
   * Fetches all campaigns for a specific Google Ads customer account.
   *
   * Without date range: Returns campaign metadata only (lightweight, fast).
   * With date range: Includes performance metrics for the specified period.
   *
   * @param customerId - Google Ads customer ID (without hyphens)
   * @param loginCustomerId - Login customer ID (for MCC accounts, use manager ID)
   * @param refreshToken - OAuth refresh token for authentication
   * @param startDate - Optional start date in YYYY-MM-DD format for metrics
   * @param endDate - Optional end date in YYYY-MM-DD format for metrics
   *
   * @returns Array of campaign objects containing metadata and optional performance metrics
   *
   * @throws Error if API query fails or date validation fails
   */
  async fetchCampaigns(
    customerId: string,
    loginCustomerId: string,
    refreshToken: string,
    startDate?: string,
    endDate?: string,
  ): Promise<IGoogleAdsCampaign[]> {
    if (startDate && endDate) {
      this.validateDateRange(startDate, endDate);
    }

    const client = this.getClient();

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
      login_customer_id: loginCustomerId,
    });

    const hasDateRange = Boolean(startDate && endDate);

    const metricsFields = hasDateRange
      ? `,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.average_cpm`
      : '';

    const whereClause = hasDateRange
      ? `WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`
      : '';

    const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.bidding_strategy_type,
      campaign.advertising_channel_type,
      campaign_budget.amount_micros,
      customer.currency_code,
      campaign.start_date,
      campaign.end_date${metricsFields}
    FROM campaign
    ${whereClause}
    ORDER BY campaign.name ASC
  `;

    try {
      const results = await customer.query(query);

      const campaigns: IGoogleAdsCampaign[] = [];

      for (const row of results) {
        if (!row.campaign || !row.campaign.id) {
          this.logger.warn(
            `Skipping campaign row with missing required data: ${JSON.stringify(row)}`,
          );
          continue;
        }

        const budgetMicros = row.campaign_budget?.amount_micros || 0;

        campaigns.push({
          campaignId: `${row.campaign.id}`,
          campaignName: row.campaign.name || 'Unknown Campaign',
          status: row.campaign.status || 'UNKNOWN',
          biddingStrategyType: row.campaign.bidding_strategy_type || 'UNKNOWN',
          advertisingChannelType:
            row.campaign.advertising_channel_type || 'UNKNOWN',
          budgetAmountMicros: budgetMicros,
          budgetAmount: budgetMicros / 1_000_000,
          currencyCode: row.customer?.currency_code || 'USD',
          startDate: row.campaign.start_date || '',
          endDate: row.campaign.end_date || undefined,
          metrics: {
            impressions: row.metrics?.impressions || 0,
            clicks: row.metrics?.clicks || 0,
            cost: (row.metrics?.cost_micros || 0) / 1_000_000,
            conversions: row.metrics?.conversions || 0,
            conversionsValue: row.metrics?.conversions_value || 0,
            ctr: row.metrics?.ctr || 0,
            averageCpc: (row.metrics?.average_cpc || 0) / 1_000_000,
            averageCpm: (row.metrics?.average_cpm || 0) / 1_000_000,
          },
        });
      }

      const dateRangeLog = hasDateRange
        ? ` with metrics from ${startDate} to ${endDate}`
        : ' (metadata only)';

      this.logger.log(
        `Fetched ${campaigns.length} campaigns for customer ${customerId}${dateRangeLog}`,
      );

      return campaigns;
    } catch (error) {
      this.logger.error(
        `Failed to fetch campaigns for customer ${customerId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fetches all ad groups for a specific Google Ads customer account.
   * Optionally filter by campaign ID to get ad groups for a specific campaign.
   *
   * @param customerId - Google Ads customer ID (without hyphens)
   * @param loginCustomerId - Login customer ID (for MCC accounts, use manager ID)
   * @param refreshToken - OAuth refresh token for authentication
   * @param campaignId - Optional campaign ID to filter ad groups
   *
   * @returns Array of ad group objects containing metadata and bidding information
   *
   * @throws Error if API query fails
   */
  async fetchAdGroups(
    customerId: string,
    loginCustomerId: string,
    refreshToken: string,
    campaignId?: string,
  ): Promise<IGoogleAdsAdGroup[]> {
    const client = this.getClient();

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
      login_customer_id: loginCustomerId,
    });

    const whereConditions = [
      `ad_group.status IN ('ENABLED', 'PAUSED')`,
      `campaign.status IN ('ENABLED', 'PAUSED')`,
    ];

    if (campaignId) {
      whereConditions.push(`campaign.id = ${campaignId}`);
    }

    const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group.status,
      ad_group.type,
      ad_group.cpc_bid_micros,
      ad_group.target_cpa_micros
    FROM ad_group
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY campaign.name ASC, ad_group.name ASC
    LIMIT 10000
  `;

    try {
      const results = await customer.query(query);

      const adGroups: IGoogleAdsAdGroup[] = [];

      for (const row of results) {
        if (
          !row.campaign ||
          !row.campaign.id ||
          !row.ad_group ||
          !row.ad_group.id
        ) {
          this.logger.warn(
            `Skipping ad group row with missing required data: ${JSON.stringify(row)}`,
          );
          continue;
        }

        const cpcBidMicros = row.ad_group.cpc_bid_micros || 0;
        const targetCpaMicros = row.ad_group.target_cpa_micros || undefined;

        adGroups.push({
          adGroupId: row.ad_group.id.toString(),
          adGroupName: row.ad_group.name || 'Unknown Ad Group',
          campaignId: row.campaign.id.toString(),
          campaignName: row.campaign.name || 'Unknown Campaign',
          status: row.ad_group.status || 'UNKNOWN',
          type: row.ad_group.type || 'UNKNOWN',
          cpcBidMicros,
          cpcBid: cpcBidMicros / 1_000_000,
          targetCpaMicros,
          targetCpa: targetCpaMicros ? targetCpaMicros / 1_000_000 : undefined,
        });
      }

      const filterDesc = campaignId
        ? `for campaign ${campaignId}`
        : 'across all campaigns';

      this.logger.log(
        `Fetched ${adGroups.length} ad groups ${filterDesc} for customer ${customerId}`,
      );

      return adGroups;
    } catch (error) {
      this.logger.error(
        `Failed to fetch ad groups for customer ${customerId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fetches all keywords for a specific ad group in Google Ads.
   * Returns keyword targeting criteria with bid information and quality metrics.
   *
   * @param customerId - Google Ads customer ID (without hyphens)
   * @param loginCustomerId - Login customer ID (for MCC accounts, use manager ID)
   * @param refreshToken - OAuth refresh token for authentication
   * @param adGroupId - Ad group ID to fetch keywords from
   * @param campaignId - Optional campaign ID for additional filtering validation
   *
   * @returns Array of keyword objects with targeting and bidding data
   *
   * @throws Error if API query fails
   */
  async fetchKeywords(
    customerId: string,
    loginCustomerId: string,
    refreshToken: string,
    adGroupId: string,
    campaignId?: string,
  ): Promise<IGoogleAdsKeyword[]> {
    const client = this.getClient();

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
      login_customer_id: loginCustomerId,
    });

    const whereConditions = [
      `ad_group.id = ${adGroupId}`,
      `ad_group_criterion.type = 'KEYWORD'`,
      `ad_group_criterion.status IN ('ENABLED', 'PAUSED')`,
    ];

    if (campaignId) {
      whereConditions.push(`campaign.id = ${campaignId}`);
    }

    const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.final_urls,
      ad_group_criterion.cpc_bid_micros,
      ad_group_criterion.quality_info.quality_score
    FROM ad_group_criterion
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY ad_group_criterion.keyword.text ASC
    LIMIT 10000
  `;

    try {
      const results = await customer.query(query);

      const keywords: IGoogleAdsKeyword[] = [];

      for (const row of results) {
        if (
          !row.campaign ||
          !row.campaign.id ||
          !row.ad_group ||
          !row.ad_group.id ||
          !row.ad_group_criterion ||
          !row.ad_group_criterion.criterion_id
        ) {
          this.logger.warn(
            `Skipping keyword row with missing required data: ${JSON.stringify(row)}`,
          );
          continue;
        }

        const cpcBidMicros = row.ad_group_criterion.cpc_bid_micros || 0;

        keywords.push({
          keywordId: row.ad_group_criterion.criterion_id.toString(),
          adGroupId: row.ad_group.id.toString(),
          adGroupName: row.ad_group.name || 'Unknown Ad Group',
          campaignId: row.campaign.id.toString(),
          campaignName: row.campaign.name || 'Unknown Campaign',
          keywordText: row.ad_group_criterion.keyword?.text || '',
          matchType:
            (row.ad_group_criterion.keyword?.match_type as string) || 'UNKNOWN',
          status: row.ad_group_criterion.status || 'UNKNOWN',
          finalUrls: row.ad_group_criterion.final_urls || [],
          cpcBidMicros,
          cpcBid: cpcBidMicros / 1_000_000,
          qualityScore: row.ad_group_criterion.quality_info?.quality_score,
        });
      }

      this.logger.log(
        `Fetched ${keywords.length} keywords for ad group ${adGroupId} in customer ${customerId}`,
      );

      return keywords;
    } catch (error) {
      this.logger.error(
        `Failed to fetch keywords for ad group ${adGroupId} in customer ${customerId}`,
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
