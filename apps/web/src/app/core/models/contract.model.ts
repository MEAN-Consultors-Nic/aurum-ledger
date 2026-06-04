export type ContractParty = {
  _id: string;
  name: string;
};

export type ContractItem = {
  _id: string;
  clientId: string | ContractParty;
  serviceId: string | ContractParty;
  title?: string;
  billingPeriod: 'monthly' | 'annual' | 'one_time';
  amount: number;
  currency: 'USD' | 'NIO';
  startDate: string;
  endDate?: string;
  status: 'active' | 'expired' | 'cancelled';
  notes?: string;
  paidTotal: number;
  paymentCount: number;
  lastPaymentDate?: string;
  balance?: number;
  financialStatus?: 'paid' | 'partial' | 'unpaid';
  createdAt?: string;
  updatedAt?: string;
};

export type ContractListResponse = {
  items: ContractItem[];
  total: number;
  page: number;
  limit: number;
};
