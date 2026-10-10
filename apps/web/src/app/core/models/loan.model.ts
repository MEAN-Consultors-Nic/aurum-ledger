export type LoanKind = 'fixed_installment' | 'interest_bearing';
export type LoanScheduleType = 'monthly_days' | 'interval_days';
export type LoanStatus = 'active' | 'settled' | 'cancelled';

export type LoanItem = {
  _id: string;
  name: string;
  kind: LoanKind;
  principal: number;
  currentBalance: number;
  currency: 'USD' | 'NIO';
  accountId: string | { _id: string; name: string; currency: 'USD' | 'NIO' };
  categoryId: string | { _id: string; name: string; type: 'income' | 'expense' };

  scheduleType: LoanScheduleType;
  daysOfMonth: number[];
  intervalDays?: number;
  startDate?: string;

  installmentAmount: number;
  totalInstallments?: number;

  interestRatePercent: number;
  capitalizedInterest: number;
  interestPaidTotal: number;
  principalPaidTotal: number;

  status: LoanStatus;
  settledAt?: string;
  isActive: boolean;
  notes?: string;

  // computed by the API
  remainingInstallments: number | null;
  nextInterestDue: number;
  progressPercent: number;
  accountCurrency: 'USD' | 'NIO';
  exchangeRate: number;
  crossCurrency: boolean;
  nextDueInAccountCurrency: number;
  balanceInAccountCurrency: number;

  createdAt?: string;
  updatedAt?: string;
};

export type LoanPaymentOccurrence = {
  _id: string;
  loanId:
    | string
    | { _id: string; name: string; kind?: LoanKind; interestRatePercent?: number; currentBalance?: number };
  accountId: string | { _id: string; name: string; currency: 'USD' | 'NIO' };
  categoryId: string | { _id: string; name: string; type: 'income' | 'expense' };
  date: string;
  amount: number;
  currency: 'USD' | 'NIO';
  status: 'planned' | 'confirmed' | 'omitted';
  sequence?: number;

  balanceBefore: number;
  balanceAfter: number;
  interestDue: number;
  paidAmount?: number;
  interestPaid: number;
  principalPaid: number;
  interestCapitalized: number;
  accountCurrency?: 'USD' | 'NIO';
  accountAmount?: number;
  exchangeRate?: number;
  note?: string;

  confirmedTransactionId?: string;
  updatedAt?: string;
};

export type LoanScheduleRow = {
  sequence: number;
  date: string;
  status: 'confirmed' | 'omitted' | 'projected';
  paid: number;
  interest: number;
  principal: number;
  capitalized: number;
  balanceAfter: number;
  actual: boolean;
};

export type LoanSchedule = {
  loan: LoanItem;
  history: LoanScheduleRow[];
  projection: LoanScheduleRow[];
  projectionBasis: number;
  projectionIsSimulation: boolean;
  projectionNote: string;
};

export type LoanAlerts = {
  count: number;
  items: LoanPaymentOccurrence[];
};

export type LoanPayload = {
  name: string;
  kind: LoanKind;
  principal: number;
  currency: 'USD' | 'NIO';
  accountId: string;
  categoryId: string;
  scheduleType: LoanScheduleType;
  daysOfMonth?: number[];
  intervalDays?: number;
  startDate?: string;
  installmentAmount?: number;
  totalInstallments?: number;
  interestRatePercent?: number;
  notes?: string;
  isActive?: boolean;
};
