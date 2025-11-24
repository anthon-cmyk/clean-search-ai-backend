import { Injectable, Logger } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { GoogleOauthRepository } from '../google-auth/google-oauth.repository';

@Injectable()
export class GoogleAdsFullSyncService {
  private readonly logger = new Logger(GoogleAdsFullSyncService.name);

  constructor(
    private googleAdsService: GoogleAdsService,
    private googleOauthRepo: GoogleOauthRepository,
  ) {}

  /**
   * Syncs campaigns, ad groups, and keywords for a customer account.
   * This gives you a complete snapshot of account structure.
   */
  async syncAccountStructure(
    userId: string,
    customerId: string,
    loginCustomerId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const connection =
      await this.googleOauthRepo.getLatestActiveConnection(userId);
    if (!connection?.refreshToken) {
      throw new Error('No active Google connection found');
    }

    const adsCustomer = await this.googleOauthRepo.getAdsCustomerByCustomerId(
      customerId,
      connection.id,
    );
    if (!adsCustomer) {
      throw new Error('Customer not found in database');
    }

    this.logger.log(`Starting full sync for customer ${customerId}`);

    const campaigns = await this.googleAdsService.fetchCampaignsWithAdGroups(
      customerId,
      loginCustomerId,
      connection.refreshToken,
      startDate,
      endDate,
      true,
    );

    let totalCampaigns = 0;
    let totalAdGroups = 0;
    let totalKeywords = 0;

    for (const campaign of campaigns) {
      const savedCampaign = await this.googleOauthRepo.upsertCampaign({
        adsCustomerId: adsCustomer.id,
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        status: campaign.status as string,
        biddingStrategyType: campaign.biddingStrategyType as string,
        advertisingChannelType: campaign.advertisingChannelType as string,
        budgetAmountMicros: campaign.budgetAmountMicros,
        currencyCode: campaign.currencyCode,
        startDate: campaign.startDate,
        endDate: campaign.endDate || null,
        impressions: campaign.metrics.impressions,
        clicks: campaign.metrics.clicks,
        cost: campaign.metrics.cost.toString(),
        conversions: campaign.metrics.conversions.toString(),
        conversionsValue: campaign.metrics.conversionsValue.toString(),
        ctr: campaign.metrics.ctr.toString(),
        averageCpc: campaign.metrics.averageCpc.toString(),
        averageCpm: campaign.metrics.averageCpm.toString(),
        metricsStartDate: startDate || null,
        metricsEndDate: endDate || null,
        lastFetchedAt: new Date(),
      });
      totalCampaigns++;

      if (campaign.adGroups && campaign.adGroups.length > 0) {
        for (const adGroup of campaign.adGroups) {
          const savedAdGroup = await this.googleOauthRepo.upsertAdGroup({
            campaignDbId: savedCampaign.id,
            campaignId: campaign.campaignId,
            adGroupId: adGroup.adGroupId,
            adGroupName: adGroup.adGroupName,
            status: adGroup.status as string,
            type: adGroup.type as string,
            cpcBidMicros: adGroup.cpcBidMicros,
            targetCpaMicros: adGroup.targetCpaMicros || null,
            lastFetchedAt: new Date(),
          });
          totalAdGroups++;

          const keywords = await this.googleAdsService.fetchKeywords(
            customerId,
            loginCustomerId,
            connection.refreshToken,
            adGroup.adGroupId,
            campaign.campaignId,
          );

          const keywordsToInsert = keywords.map((kw) => ({
            adGroupDbId: savedAdGroup.id,
            adGroupId: adGroup.adGroupId,
            keywordId: kw.keywordId,
            keywordText: kw.keywordText,
            matchType: kw.matchType,
            status: kw.status as string,
            finalUrls: kw.finalUrls,
            cpcBidMicros: kw.cpcBidMicros,
            qualityScore: kw.qualityScore || null,
            lastFetchedAt: new Date(),
          }));

          const keywordCount =
            await this.googleOauthRepo.bulkUpsertKeywords(keywordsToInsert);
          totalKeywords += keywordCount;
        }
      }
    }

    this.logger.log(
      `Full sync completed: ${totalCampaigns} campaigns, ${totalAdGroups} ad groups, ${totalKeywords} keywords`,
    );

    return {
      totalCampaigns,
      totalAdGroups,
      totalKeywords,
    };
  }
}
