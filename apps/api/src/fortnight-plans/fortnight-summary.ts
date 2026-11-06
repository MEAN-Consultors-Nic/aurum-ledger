/**
 * Pure maths behind a fortnight plan. No I/O, so it can be unit-tested and
 * re-run over frozen data when a plan is closed.
 *
 * Every figure is reported four ways, because the user earns in dollars but
 * pays in both currencies:
 *   USD / NIO          — sum of the lines natively in that currency
 *   totalUsd / totalNio — everything converted at one rate (córdobas per dollar)
 */
export type Currency = 'USD' | 'NIO';

export type Money = {
  USD: number;
  NIO: number;
  totalUsd: number;
  totalNio: number;
};

export type SummaryLine = {
  kind: 'income' | 'expense' | 'savings';
  status: 'planned' | 'applying' | 'applied' | 'skipped' | 'carried';
  plannedAmount: number;
  appliedAmount?: number;
  currency: Currency;
  categoryId?: string;
  categoryName?: string;
  dueDate?: Date;
  unplanned?: boolean;
};

export type UnlinkedTransaction = {
  _id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: Currency;
  date: Date;
  categoryId?: string;
  categoryName?: string;
  accountName?: string;
  reference?: string;
  notes?: string;
};

export type AccountBalance = { currency: Currency; currentBalance: number };

export type CategoryRow = {
  categoryId: string | null;
  name: string;
  planned: Money;
  applied: Money;
  unplanned: Money;
  actual: Money;
};

export type DisciplineScore = {
  /** 0–100, or null while nothing has been decided yet. */
  score: number | null;
  /** Applied ÷ lines that had to be decided by now (due, skipped or carried). */
  executionRate: number | null;
  /** 1 − |applied − planned| ÷ planned over applied expense lines. */
  amountAccuracy: number | null;
  /** Share of actual spending that was never planned. */
  unplannedShare: number | null;
};

export type FortnightSummary = {
  fxRate: number;
  income: { planned: Money; applied: Money; pending: Money };
  expense: { planned: Money; applied: Money; pending: Money };
  savings: { planned: Money; applied: Money; pending: Money };
  /** The sheet's "Available": planned income − planned expenses − planned savings. */
  available: Money;
  /** Real money in the accounts right now (null on frozen summaries). */
  cashNow: Money | null;
  /** Cash now + income still to come − expenses and savings still to go. */
  projectedFree: Money | null;
  unplanned: {
    expense: Money;
    income: Money;
    count: number;
  };
  /** Planned expenses actually executed + unplanned spending. */
  actualSpend: Money;
  byCategory: CategoryRow[];
  counts: {
    total: number;
    planned: number;
    applied: number;
    skipped: number;
    carried: number;
    overdue: number;
  };
  discipline: DisciplineScore;
};

export const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function emptyMoney(): Money {
  return { USD: 0, NIO: 0, totalUsd: 0, totalNio: 0 };
}

export function toUsd(amount: number, currency: Currency, fxRate: number) {
  return currency === 'USD' ? amount : amount / fxRate;
}

export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  fxRate: number,
) {
  if (from === to) return round2(amount);
  return to === 'USD' ? round2(amount / fxRate) : round2(amount * fxRate);
}

function add(
  target: Money,
  amount: number,
  currency: Currency,
  fxRate: number,
) {
  target[currency] += amount;
  const usd = toUsd(amount, currency, fxRate);
  target.totalUsd += usd;
  target.totalNio += usd * fxRate;
}

function minus(a: Money, b: Money): Money {
  return {
    USD: a.USD - b.USD,
    NIO: a.NIO - b.NIO,
    totalUsd: a.totalUsd - b.totalUsd,
    totalNio: a.totalNio - b.totalNio,
  };
}

function plus(a: Money, b: Money): Money {
  return {
    USD: a.USD + b.USD,
    NIO: a.NIO + b.NIO,
    totalUsd: a.totalUsd + b.totalUsd,
    totalNio: a.totalNio + b.totalNio,
  };
}

function rounded(m: Money): Money {
  return {
    USD: round2(m.USD),
    NIO: round2(m.NIO),
    totalUsd: round2(m.totalUsd),
    totalNio: round2(m.totalNio),
  };
}

const ratio = (value: number) => Math.round(value * 1000) / 1000;

export function computeSummary(input: {
  lines: SummaryLine[];
  unlinked: UnlinkedTransaction[];
  balances: AccountBalance[] | null;
  fxRate: number;
  now: Date;
}): FortnightSummary {
  const fx = input.fxRate > 0 ? input.fxRate : 36;
  const today = new Date(
    input.now.getFullYear(),
    input.now.getMonth(),
    input.now.getDate(),
  );

  const buckets = {
    income: {
      planned: emptyMoney(),
      applied: emptyMoney(),
      pending: emptyMoney(),
    },
    expense: {
      planned: emptyMoney(),
      applied: emptyMoney(),
      pending: emptyMoney(),
    },
    savings: {
      planned: emptyMoney(),
      applied: emptyMoney(),
      pending: emptyMoney(),
    },
  };
  const unplannedExpense = emptyMoney();
  const unplannedIncome = emptyMoney();
  let unplannedCount = 0;

  const counts = {
    total: 0,
    planned: 0,
    applied: 0,
    skipped: 0,
    carried: 0,
    overdue: 0,
  };
  const categories = new Map<string, CategoryRow>();
  const categoryRow = (id: string | undefined, name: string | undefined) => {
    const key = id ?? '__none__';
    let row = categories.get(key);
    if (!row) {
      row = {
        categoryId: id ?? null,
        name: name ?? 'Uncategorized',
        planned: emptyMoney(),
        applied: emptyMoney(),
        unplanned: emptyMoney(),
        actual: emptyMoney(),
      };
      categories.set(key, row);
    }
    return row;
  };

  // discipline inputs (outflows only: income is not a behaviour to control)
  let mustDecide = 0;
  let decidedApplied = 0;
  let accuracyPlanned = 0;
  let accuracyDelta = 0;

  for (const line of input.lines) {
    const isOpenStatus =
      line.status === 'planned' || line.status === 'applying';
    const applied = line.status === 'applied';

    // A line recorded as unplanned spending is never part of the plan.
    if (line.unplanned) {
      if (applied) {
        const amount = line.appliedAmount ?? line.plannedAmount;
        if (line.kind === 'income') {
          add(unplannedIncome, amount, line.currency, fx);
        } else {
          add(unplannedExpense, amount, line.currency, fx);
          const row = categoryRow(line.categoryId, line.categoryName);
          add(row.unplanned, amount, line.currency, fx);
          add(row.actual, amount, line.currency, fx);
        }
        unplannedCount += 1;
      }
      continue;
    }

    counts.total += 1;
    if (isOpenStatus) counts.planned += 1;
    if (applied) counts.applied += 1;
    if (line.status === 'skipped') counts.skipped += 1;
    if (line.status === 'carried') counts.carried += 1;

    const overdue = isOpenStatus && !!line.dueDate && line.dueDate < today;
    if (overdue) counts.overdue += 1;

    // Skipped and carried lines leave this fortnight's plan entirely.
    if (line.status === 'skipped' || line.status === 'carried') {
      if (line.kind !== 'income') mustDecide += 1;
      continue;
    }

    const bucket = buckets[line.kind];
    add(bucket.planned, line.plannedAmount, line.currency, fx);

    if (applied) {
      const amount = line.appliedAmount ?? line.plannedAmount;
      add(bucket.applied, amount, line.currency, fx);
      if (line.kind !== 'income') {
        mustDecide += 1;
        decidedApplied += 1;
      }
      if (line.kind === 'expense') {
        accuracyPlanned += toUsd(line.plannedAmount, line.currency, fx);
        accuracyDelta += Math.abs(
          toUsd(amount - line.plannedAmount, line.currency, fx),
        );
      }
    } else {
      add(bucket.pending, line.plannedAmount, line.currency, fx);
      if (overdue && line.kind !== 'income') mustDecide += 1;
    }

    if (line.kind === 'expense') {
      const row = categoryRow(line.categoryId, line.categoryName);
      add(row.planned, line.plannedAmount, line.currency, fx);
      if (applied) {
        const amount = line.appliedAmount ?? line.plannedAmount;
        add(row.applied, amount, line.currency, fx);
        add(row.actual, amount, line.currency, fx);
      }
    }
  }

  for (const tx of input.unlinked) {
    unplannedCount += 1;
    if (tx.type === 'income') {
      add(unplannedIncome, tx.amount, tx.currency, fx);
      continue;
    }
    add(unplannedExpense, tx.amount, tx.currency, fx);
    const row = categoryRow(tx.categoryId, tx.categoryName);
    add(row.unplanned, tx.amount, tx.currency, fx);
    add(row.actual, tx.amount, tx.currency, fx);
  }

  const available = minus(
    minus(buckets.income.planned, buckets.expense.planned),
    buckets.savings.planned,
  );

  let cashNow: Money | null = null;
  let projectedFree: Money | null = null;
  if (input.balances) {
    cashNow = emptyMoney();
    for (const balance of input.balances) {
      add(cashNow, balance.currentBalance, balance.currency, fx);
    }
    projectedFree = minus(
      minus(plus(cashNow, buckets.income.pending), buckets.expense.pending),
      buckets.savings.pending,
    );
  }

  const actualSpend = plus(buckets.expense.applied, unplannedExpense);

  const executionRate = mustDecide > 0 ? decidedApplied / mustDecide : null;
  const amountAccuracy =
    accuracyPlanned > 0
      ? Math.max(0, 1 - Math.min(1, accuracyDelta / accuracyPlanned))
      : null;
  const unplannedShare =
    actualSpend.totalUsd > 0
      ? unplannedExpense.totalUsd / actualSpend.totalUsd
      : null;

  const parts: Array<[number, number]> = [];
  if (executionRate !== null) parts.push([executionRate, 0.5]);
  if (amountAccuracy !== null) parts.push([amountAccuracy, 0.3]);
  if (unplannedShare !== null) parts.push([1 - unplannedShare, 0.2]);
  const weight = parts.reduce((sum, [, w]) => sum + w, 0);
  const score =
    weight > 0
      ? Math.round(
          (parts.reduce((sum, [v, w]) => sum + v * w, 0) / weight) * 100,
        )
      : null;

  const roundBucket = (b: {
    planned: Money;
    applied: Money;
    pending: Money;
  }) => ({
    planned: rounded(b.planned),
    applied: rounded(b.applied),
    pending: rounded(b.pending),
  });

  return {
    fxRate: fx,
    income: roundBucket(buckets.income),
    expense: roundBucket(buckets.expense),
    savings: roundBucket(buckets.savings),
    available: rounded(available),
    cashNow: cashNow ? rounded(cashNow) : null,
    projectedFree: projectedFree ? rounded(projectedFree) : null,
    unplanned: {
      expense: rounded(unplannedExpense),
      income: rounded(unplannedIncome),
      count: unplannedCount,
    },
    actualSpend: rounded(actualSpend),
    byCategory: Array.from(categories.values())
      .map((row) => ({
        ...row,
        planned: rounded(row.planned),
        applied: rounded(row.applied),
        unplanned: rounded(row.unplanned),
        actual: rounded(row.actual),
      }))
      .sort(
        (a, b) =>
          Math.max(b.planned.totalUsd, b.actual.totalUsd) -
          Math.max(a.planned.totalUsd, a.actual.totalUsd),
      ),
    counts,
    discipline: {
      score,
      executionRate: executionRate === null ? null : ratio(executionRate),
      amountAccuracy: amountAccuracy === null ? null : ratio(amountAccuracy),
      unplannedShare: unplannedShare === null ? null : ratio(unplannedShare),
    },
  };
}
