export interface IGoogleAdsAccount {
  customerId: string;
  customerName: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
  isManagerAccount: boolean;
  canManageClients: boolean;
}

export interface IGoogleAdsSearchTerm {
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  searchTerm: string;
  keyword: string;
  metrics: {
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
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
