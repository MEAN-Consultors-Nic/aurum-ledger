import { computeSummary, convert, SummaryLine } from './fortnight-summary';

const FX = 36.5;
const NOW = new Date(2026, 10, 10); // Nov 10

const line = (overrides: Partial<SummaryLine>): SummaryLine => ({
  kind: 'expense',
  status: 'planned',
  plannedAmount: 0,
  currency: 'USD',
  ...overrides,
});

describe('computeSummary', () => {
  it('reproduces the sheet: total income − total debts = available', () => {
    const summary = computeSummary({
      lines: [
        line({ kind: 'income', plannedAmount: 2725 }),
        line({ plannedAmount: 300 }),
        line({ plannedAmount: 136.99 }),
        line({ plannedAmount: 40 }),
        line({ plannedAmount: 50 }),
        line({ plannedAmount: 55 }),
        line({ plannedAmount: 100 }),
        line({ plannedAmount: 250 }),
        line({ plannedAmount: 180 }),
        line({ plannedAmount: 50 }),
        line({ plannedAmount: 300 }),
        line({ plannedAmount: 100 }),
      ],
      unlinked: [],
      balances: null,
      fxRate: FX,
      now: NOW,
    });
    expect(summary.expense.planned.totalUsd).toBe(1561.99);
    expect(summary.available.totalUsd).toBe(1163.01);
  });

  it('keeps native currencies apart and converts totals both ways', () => {
    const summary = computeSummary({
      lines: [
        line({ plannedAmount: 100, currency: 'USD' }),
        line({ plannedAmount: 3650, currency: 'NIO' }),
      ],
      unlinked: [],
      balances: null,
      fxRate: FX,
      now: NOW,
    });
    expect(summary.expense.planned.USD).toBe(100);
    expect(summary.expense.planned.NIO).toBe(3650);
    expect(summary.expense.planned.totalUsd).toBe(200);
    expect(summary.expense.planned.totalNio).toBe(7300);
  });

  it('tracks applied vs pending and uses what was really paid', () => {
    const summary = computeSummary({
      lines: [
        line({ plannedAmount: 250, status: 'applied', appliedAmount: 250 }),
        line({ plannedAmount: 55, status: 'applied', appliedAmount: 60 }),
        line({ plannedAmount: 100, status: 'planned' }),
      ],
      unlinked: [],
      balances: null,
      fxRate: FX,
      now: NOW,
    });
    expect(summary.expense.applied.totalUsd).toBe(310);
    expect(summary.expense.pending.totalUsd).toBe(100);
    expect(summary.expense.planned.totalUsd).toBe(405);
  });

  it('removes skipped and carried lines from the plan but not from the counts', () => {
    const summary = computeSummary({
      lines: [
        line({ plannedAmount: 100, status: 'skipped' }),
        line({ plannedAmount: 80, status: 'carried' }),
        line({ plannedAmount: 50 }),
      ],
      unlinked: [],
      balances: null,
      fxRate: FX,
      now: NOW,
    });
    expect(summary.expense.planned.totalUsd).toBe(50);
    expect(summary.counts).toMatchObject({
      total: 3,
      skipped: 1,
      carried: 1,
      planned: 1,
    });
  });

  it('counts unplanned spending from both unlinked movements and lines recorded as unplanned', () => {
    const summary = computeSummary({
      lines: [
        line({
          plannedAmount: 100,
          status: 'applied',
          appliedAmount: 100,
          categoryId: 'food',
          categoryName: 'Food',
        }),
        line({
          plannedAmount: 730,
          currency: 'NIO',
          status: 'applied',
          appliedAmount: 730,
          unplanned: true,
          categoryId: 'food',
          categoryName: 'Food',
        }),
      ],
      unlinked: [
        {
          _id: 't1',
          type: 'expense',
          amount: 30,
          currency: 'USD',
          date: NOW,
          categoryId: 'fun',
          categoryName: 'Fun',
        },
        { _id: 't2', type: 'income', amount: 50, currency: 'USD', date: NOW },
      ],
      balances: null,
      fxRate: FX,
      now: NOW,
    });
    expect(summary.unplanned.expense.totalUsd).toBe(50); // 730 C$ = 20 USD + 30 USD
    expect(summary.unplanned.income.totalUsd).toBe(50);
    expect(summary.unplanned.count).toBe(3);
    expect(summary.actualSpend.totalUsd).toBe(150);
    // the unplanned line never enters the plan
    expect(summary.expense.planned.totalUsd).toBe(100);
    const food = summary.byCategory.find((row) => row.categoryId === 'food')!;
    expect(food.planned.totalUsd).toBe(100);
    expect(food.actual.totalUsd).toBe(120);
    expect(food.unplanned.NIO).toBe(730);
  });

  it('projects free cash: cash now + income to come − outflows to go', () => {
    const summary = computeSummary({
      lines: [
        line({ kind: 'income', plannedAmount: 1000 }),
        line({ plannedAmount: 300 }),
        line({ kind: 'savings', plannedAmount: 200 }),
      ],
      unlinked: [],
      balances: [
        { currency: 'USD', currentBalance: 500 },
        { currency: 'NIO', currentBalance: 3650 },
      ],
      fxRate: FX,
      now: NOW,
    });
    expect(summary.cashNow!.totalUsd).toBe(600);
    expect(summary.projectedFree!.totalUsd).toBe(1100);
  });

  it('scores discipline only on what had to be decided by now', () => {
    const none = computeSummary({
      lines: [line({ plannedAmount: 100, dueDate: new Date(2026, 10, 14) })],
      unlinked: [],
      balances: null,
      fxRate: FX,
      now: NOW,
    });
    expect(none.discipline.score).toBeNull();

    const mixed = computeSummary({
      lines: [
        // on time and exact
        line({ plannedAmount: 100, status: 'applied', appliedAmount: 100 }),
        // overdue, not applied
        line({ plannedAmount: 100, dueDate: new Date(2026, 10, 5) }),
        // not due yet: does not count
        line({ plannedAmount: 100, dueDate: new Date(2026, 10, 14) }),
      ],
      unlinked: [
        { _id: 'x', type: 'expense', amount: 100, currency: 'USD', date: NOW },
      ],
      balances: null,
      fxRate: FX,
      now: NOW,
    });
    expect(mixed.counts.overdue).toBe(1);
    expect(mixed.discipline.executionRate).toBe(0.5);
    expect(mixed.discipline.amountAccuracy).toBe(1);
    expect(mixed.discipline.unplannedShare).toBe(0.5);
    // 0.5·0.5 + 0.3·1 + 0.2·0.5 = 0.65
    expect(mixed.discipline.score).toBe(65);
  });

  it('ignores income when scoring behaviour', () => {
    const summary = computeSummary({
      lines: [
        line({
          kind: 'income',
          plannedAmount: 1000,
          dueDate: new Date(2026, 10, 1),
        }),
      ],
      unlinked: [],
      balances: null,
      fxRate: FX,
      now: NOW,
    });
    expect(summary.discipline.executionRate).toBeNull();
    expect(summary.counts.overdue).toBe(1);
  });
});

describe('convert', () => {
  it('rounds to cents in both directions', () => {
    expect(convert(100, 'USD', 'NIO', FX)).toBe(3650);
    expect(convert(1000, 'NIO', 'USD', FX)).toBe(27.4);
    expect(convert(12.345, 'USD', 'USD', FX)).toBe(12.35);
  });
});
