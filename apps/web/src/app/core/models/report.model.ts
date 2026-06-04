export type ReceivableItem = {
  id: string;
  name?: string;
  totalUsd: number;
  totalNio: number;
};

export type PaymentsReportItem = {
  _id: string;
  contractId: { _id: string; title?: string } | string;
  clientId: { _id: string; name?: string } | string;
  amount: number;
  retentionAmount?: number;
  currency?: 'USD' | 'NIO';
  exchangeRate?: number;
  paymentDate: string;
  method: 'cash' | 'bank' | 'card' | 'transfer' | 'other';
  reference?: string;
  notes?: string;
};

export type PaymentsReportResponse = {
  totalUsd: number;
  totalNio: number;
  items: PaymentsReportItem[];
};

export type TrendItem = {
  month: string;
  totalReceivableUsd: number;
  totalReceivableNio: number;
  totalPaidUsd: number;
  totalPaidNio: number;
  balanceUsd: number;
  balanceNio: number;
};

export type ProjectionItem = {
  month: string;
  plannedUsd: number;
  plannedNio: number;
  contractUsd: number;
  contractNio: number;
  totalUsd: number;
  totalNio: number;
};
