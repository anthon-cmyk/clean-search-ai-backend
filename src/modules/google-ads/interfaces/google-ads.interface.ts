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
  matchType: string;
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
  status: string;
  biddingStrategyType: string;
  budgetAmountMicros: number;
  budgetAmount: number;
  currencyCode: string;
  startDate: string;
  endDate?: string;
  advertisingChannelType: string;
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
