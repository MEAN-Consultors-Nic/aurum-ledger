import {
  isPeriodKey,
  nextPeriod,
  parseDay,
  parsePeriodKey,
  periodForDate,
  previousPeriod,
  shiftIntoPeriod,
} from './fortnight-period';

describe('fortnight-period', () => {
  it('splits the month at the 15th', () => {
    expect(periodForDate(new Date(2026, 10, 1)).key).toBe('2026-11-1');
    expect(periodForDate(new Date(2026, 10, 15, 23, 59)).key).toBe('2026-11-1');
    expect(periodForDate(new Date(2026, 10, 16)).key).toBe('2026-11-2');
    expect(periodForDate(new Date(2026, 10, 30)).key).toBe('2026-11-2');
  });

  it('builds windows that end on the last day of the month', () => {
    const feb = parsePeriodKey('2027-02-2');
    expect(feb.start).toEqual(new Date(2027, 1, 16));
    expect(feb.end).toEqual(new Date(2027, 1, 28, 23, 59, 59, 999));
    expect(feb.label).toBe('Feb 16–28, 2027');

    const leap = parsePeriodKey('2028-02-2');
    expect(leap.end.getDate()).toBe(29);

    const first = parsePeriodKey('2026-11-1');
    expect(first.label).toBe('Nov 1–15, 2026');
    expect(first.end).toEqual(new Date(2026, 10, 15, 23, 59, 59, 999));
  });

  it('walks across months and years', () => {
    expect(nextPeriod(parsePeriodKey('2026-11-1')).key).toBe('2026-11-2');
    expect(nextPeriod(parsePeriodKey('2026-12-2')).key).toBe('2027-01-1');
    expect(previousPeriod(parsePeriodKey('2027-01-1')).key).toBe('2026-12-2');
    expect(previousPeriod(parsePeriodKey('2026-11-2')).key).toBe('2026-11-1');
  });

  it('validates keys', () => {
    expect(isPeriodKey('2026-11-1')).toBe(true);
    expect(isPeriodKey('2026-11-3')).toBe(false);
    expect(isPeriodKey('2026-13-1')).toBe(false);
    expect(isPeriodKey('2026-1-1')).toBe(false);
    expect(() => parsePeriodKey('nope')).toThrow();
  });

  it('parses calendar days as local midnight', () => {
    expect(parseDay('2026-11-20')).toEqual(new Date(2026, 10, 20));
    expect(() => parseDay('20/11/2026')).toThrow();
  });

  it('moves a due date to the same position of another fortnight, clamped', () => {
    const from = parsePeriodKey('2026-11-1');
    const to = parsePeriodKey('2026-11-2');
    expect(shiftIntoPeriod(new Date(2026, 10, 5), from, to)).toEqual(
      new Date(2026, 10, 20),
    );
    // Nov 16–30 has 15 days, Feb 16–28 only 13: the 30th clamps to the 28th.
    const febHalf = parsePeriodKey('2027-02-2');
    expect(shiftIntoPeriod(new Date(2026, 10, 30), to, febHalf)).toEqual(
      new Date(2027, 1, 28),
    );
    expect(shiftIntoPeriod(undefined, from, to)).toBeUndefined();
  });
});
