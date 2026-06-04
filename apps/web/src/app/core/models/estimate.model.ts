export type EstimateParty = {
  _id: string;
  name: string;
};

export type EstimateItem = {
  _id: string;
  clientId: string | EstimateParty;
  serviceId: string | EstimateParty;
  title?: string;
  billingPeriod: 'monthly' | 'annual' | 'one_time';
  amount: number;
  currency: 'USD' | 'NIO';
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  notes?: string;
  scope?: string;
  deliverables?: string[];
  terms?: string;
  validUntil?: string;
  sentAt?: string;
  sentBy?: string;
  conversionNotes?: string;
  convertedContractId?: string;
  convertedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  shareToken?: string;
  shareCreatedAt?: string;
  shareRevokedAt?: string;
  shareViewCount?: number;
  shareLastViewedAt?: string;
};

export type EstimateListResponse = {
  items: EstimateItem[];
  total: number;
  page: number;
  limit: number;
};

export type EstimateConvertResponse = {
  estimate: EstimateItem;
  contract: {
    _id: string;
  };
};
