import { enums } from 'google-ads-api';

export interface IGoogleAdsAccount {
  customerId: string;
  customerName: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  isManagerAccount: boolean;
  canManageClients: boolean;

  loginCustomerId: string; // must use in Customer() for auth
  managerCustomerId?: string | null; // manager that owns this client
}

export interface IGoogleAdsSearchTerm {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  searchTerm: string;
  keyword: string;
  matchType: enums.KeywordMatchType | string;
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conversionsValue: number;
  };
}

export interface IGoogleAdsCampaign {
  campaignId: string;
  campaignName: string;
  status: enums.CampaignStatus | string;
  biddingStrategyType: enums.BiddingStrategyType | string;
  budgetAmountMicros: enums.AdvertisingChannelType | number;
  budgetAmount: number;
  currencyCode: string;
  startDate: string;
  endDate?: string;
  advertisingChannelType: enums.AdvertisingChannelType | string;
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conversionsValue: number;
    ctr: number;
    averageCpc: number;
    averageCpm: number;
  };
}

export interface ISyncResult {
  jobId: string;
  customerId: string;
  customerName: string;
  status: 'completed' | 'failed';
  recordsFetched: number;
  recordsStored: number;
  startDate: string;
  endDate: string;
  errorMessage?: string;
}

export interface IGoogleAdsAdGroup {
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  status: enums.AdGroupStatus | string;
  type: enums.AdGroupType | string;
  cpcBidMicros: number;
  cpcBid: number;
  targetCpaMicros?: number;
  targetCpa?: number;
}

export interface IGoogleAdsKeyword {
  keywordId: string;
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  keywordText: string;
  matchType: string;
  status: enums.AdGroupCriterionStatus | string;
  finalUrls: string[];
  cpcBidMicros: number;
  cpcBid: number;
  qualityScore?: number | null;
}
