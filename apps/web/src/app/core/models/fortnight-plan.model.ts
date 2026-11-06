export type Currency = 'USD' | 'NIO';

export type Money = { USD: number; NIO: number; totalUsd: number; totalNio: number };

export type PlanLineKind = 'income' | 'expense' | 'savings';
export type PlanLineSource = 'manual' | 'loan' | 'recurring_expense' | 'subscription' | 'planned_income';
export type PlanLineStatus = 'planned' | 'applying' | 'applied' | 'skipped' | 'carried';

export type PlanLine = {
  _id: string;
  kind: PlanLineKind;
  source: PlanLineSource;
  sourceId?: string;
  sourceOccurrenceId?: string;
  name: string;
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  plannedAmount: number;
  currency: Currency;
  amountOverridden?: boolean;
  dueDate?: string;
  status: PlanLineStatus;
  appliedAmount?: number;
  appliedAccountAmount?: number;
  appliedAccountCurrency?: Currency;
  appliedExchangeRate?: number;
  appliedDate?: string;
  transactionId?: string;
  note?: string;
  repeat?: boolean;
  unplanned?: boolean;
  carriedFromPeriod?: string;
  carriedToPeriod?: string;
  promotedToRecurringId?: string;
  meta?: { loanKind?: string; loanBalance?: number; interestRatePercent?: number; sequence?: number };
  // decorated by the API
  dueDay: string | null;
  appliedDay: string | null;
  accountName: string | null;
  accountCurrency: Currency | null;
  toAccountName: string | null;
  categoryName: string | null;
  overdue: boolean;
  canUndo: boolean;
};

export type CategoryRow = {
  categoryId: string | null;
  name: string;
  planned: Money;
  applied: Money;
  unplanned: Money;
  actual: Money;
};

export type Discipline = {
  score: number | null;
  executionRate: number | null;
  amountAccuracy: number | null;
  unplannedShare: number | null;
};

export type FortnightSummary = {
  fxRate: number;
  income: { planned: Money; applied: Money; pending: Money };
  expense: { planned: Money; applied: Money; pending: Money };
  savings: { planned: Money; applied: Money; pending: Money };
  available: Money;
  cashNow: Money | null;
  projectedFree: Money | null;
  unplanned: { expense: Money; income: Money; count: number };
  actualSpend: Money;
  byCategory: CategoryRow[];
  counts: { total: number; planned: number; applied: number; skipped: number; carried: number; overdue: number };
  discipline: Discipline;
};

export type UnplannedTransaction = {
  _id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: Currency;
  date: string;
  day: string | null;
  categoryName?: string;
  accountName?: string;
  reference?: string;
  notes?: string;
};

export type FortnightPeriodInfo = {
  key: string;
  label: string;
  start: string;
  end: string;
  previousKey: string;
  previousLabel: string;
  nextKey: string;
  nextLabel: string;
  isCurrent: boolean;
  isPast: boolean;
};

export type FortnightPlan = {
  _id: string;
  periodKey: string;
  status: 'open' | 'closed';
  notes?: string;
  lines: PlanLine[];
  closedAt?: string;
  lastSyncedAt?: string;
  /** Set when the planning wizard was finished; until then the plan is a draft. */
  plannedAt?: string;
};

export type FortnightDetail = {
  period: FortnightPeriodInfo;
  fxRate: number;
  plan: FortnightPlan | null;
  summary: FortnightSummary | null;
  liveSummary?: FortnightSummary;
  unplannedTransactions: UnplannedTransaction[];
  previousOpen: boolean;
};

export type FortnightAnalytics = {
  fxRate: number;
  averageScore: number | null;
  periods: Array<{
    periodKey: string;
    label: string;
    status: 'open' | 'closed';
    incomePlanned: Money;
    incomeApplied: Money;
    expensePlanned: Money;
    expenseApplied: Money;
    savingsApplied: Money;
    unplannedExpense: Money;
    actualSpend: Money;
    available: Money;
    discipline: Discipline;
  }>;
  categories: Array<{ name: string; plannedUsd: number; actualUsd: number; unplannedUsd: number; actualNio: number }>;
};

export type CreatePlanLinePayload = {
  kind: PlanLineKind;
  name: string;
  plannedAmount: number;
  currency: Currency;
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  dueDate?: string;
  note?: string;
  repeat?: boolean;
};

export type ApplyLinePayload = {
  amount?: number;
  date?: string;
  accountId?: string;
  categoryId?: string;
  toAccountId?: string;
  note?: string;
  keepRemainder?: boolean;
};

export type RecordUnplannedPayload = {
  kind?: 'expense' | 'income';
  name: string;
  amount: number;
  currency: Currency;
  accountId: string;
  categoryId: string;
  date?: string;
  note?: string;
};
