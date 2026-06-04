export type LoanItem = {
  _id: string;
  name: string;
  principal: number;
  installmentAmount: number;
  currency: 'USD' | 'NIO';
  accountId: string | { _id: string; name: string; currency: 'USD' | 'NIO' };
  categoryId: string | { _id: string; name: string; type: 'income' | 'expense' };
  daysOfMonth: number[];
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LoanPaymentOccurrence = {
  _id: string;
  loanId: string | { _id: string; name: string };
  accountId: string | { _id: string; name: string; currency: 'USD' | 'NIO' };
  categoryId: string | { _id: string; name: string; type: 'income' | 'expense' };
  date: string;
  amount: number;
  currency: 'USD' | 'NIO';
  status: 'planned' | 'confirmed' | 'omitted';
  confirmedTransactionId?: string;
  updatedAt?: string;
};

export type LoanAlerts = {
  count: number;
  items: LoanPaymentOccurrence[];
};
