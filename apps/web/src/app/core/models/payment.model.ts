export type PaymentParty = {
  _id: string;
  name?: string;
  title?: string;
};

export type PaymentItem = {
  _id: string;
  contractId: string | PaymentParty;
  clientId: string | PaymentParty;
  accountId: string | PaymentParty;
  amount: number;
  retentionAmount?: number;
  currency: 'USD' | 'NIO';
  exchangeRate: number;
  paymentDate: string;
  method: 'cash' | 'bank' | 'paypal' | 'card' | 'transfer' | 'other';
  reference?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PaymentListResponse = {
  items: PaymentItem[];
  total: number;
  page: number;
  limit: number;
};
