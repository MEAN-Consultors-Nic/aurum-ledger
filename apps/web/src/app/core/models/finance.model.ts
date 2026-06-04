export type FinanceOverview = {
  balanceUsd: number;
  balanceNio: number;
};

export type FinanceByCategoryItem = {
  categoryId: string;
  categoryName: string;
  currency: 'USD' | 'NIO';
  total: number;
  budget: number;
};

export type FinanceByClientItem = {
  clientId: string;
  clientName?: string;
  currency: 'USD' | 'NIO';
  total: number;
};

export type FinanceByContractItem = {
  contractId: string;
  contractTitle?: string;
  currency: 'USD' | 'NIO';
  total: number;
};
