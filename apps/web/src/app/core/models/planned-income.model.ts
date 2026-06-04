export type PlannedIncomeItem = {
  _id: string;
  name: string;
  amount: number;
  currency: 'USD' | 'NIO';
  accountId: string | { _id: string; name: string; currency: 'USD' | 'NIO' };
  categoryId: string | { _id: string; name: string; type: 'income' | 'expense' };
  daysOfMonth: number[];
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type PlannedIncomeOccurrence = {
  _id: string;
  plannedIncomeId: string | { _id: string; name: string };
  accountId: string | { _id: string; name: string; currency: 'USD' | 'NIO' };
  categoryId: string | { _id: string; name: string; type: 'income' | 'expense' };
  date: string;
  amount: number;
  currency: 'USD' | 'NIO';
  status: 'planned' | 'confirmed' | 'omitted';
  receivedAmount?: number;
  feeAmount?: number;
  confirmationNote?: string;
  confirmedTransactionId?: string;
  updatedAt?: string;
};

export type PlannedIncomeSummary = {
  month: string;
  totals: {
    plannedUsd: number;
    plannedNio: number;
    confirmedUsd: number;
    confirmedNio: number;
    varianceUsd: number;
    varianceNio: number;
  };
  byAccount: Array<{
    accountId: string;
    accountName: string;
    currency: 'USD' | 'NIO';
    plannedTotal: number;
    confirmedTotal: number;
    variance: number;
  }>;
};

export type PlannedIncomeAlerts = {
  count: number;
  items: PlannedIncomeOccurrence[];
};
