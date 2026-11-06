/**
 * A fortnight is half a calendar month: the 1st–15th, or the 16th to the end
 * of the month. It is identified by a period key "YYYY-MM-1" / "YYYY-MM-2".
 *
 * Dates use the server's local calendar, exactly like the occurrence
 * generators in loans / recurring expenses / subscriptions / planned incomes
 * (`new Date(year, monthIndex, day)`), so a period window and the occurrences
 * that fall inside it always agree.
 */
export type FortnightHalf = 1 | 2;

export type FortnightPeriod = {
  key: string;
  year: number;
  /** 1-based month. */
  month: number;
  half: FortnightHalf;
  start: Date;
  end: Date;
  label: string;
};

export const PERIOD_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-[12]$/;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function isPeriodKey(value: string): boolean {
  return PERIOD_KEY_PATTERN.test(value);
}

export function periodFromParts(
  year: number,
  month: number,
  half: FortnightHalf,
): FortnightPeriod {
  const monthIndex = month - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const startDay = half === 1 ? 1 : 16;
  const endDay = half === 1 ? 15 : lastDay;
  return {
    key: `${year}-${String(month).padStart(2, '0')}-${half}`,
    year,
    month,
    half,
    start: new Date(year, monthIndex, startDay),
    end: new Date(year, monthIndex, endDay, 23, 59, 59, 999),
    label: `${MONTHS[monthIndex]} ${startDay}–${endDay}, ${year}`,
  };
}

export function parsePeriodKey(key: string): FortnightPeriod {
  if (!isPeriodKey(key)) {
    throw new Error(
      `Invalid fortnight key "${key}". Expected YYYY-MM-1 or YYYY-MM-2.`,
    );
  }
  const [year, month, half] = key.split('-').map(Number);
  return periodFromParts(year, month, half as FortnightHalf);
}

export function periodForDate(date: Date): FortnightPeriod {
  const half: FortnightHalf = date.getDate() <= 15 ? 1 : 2;
  return periodFromParts(date.getFullYear(), date.getMonth() + 1, half);
}

export function nextPeriod(period: FortnightPeriod): FortnightPeriod {
  if (period.half === 1) {
    return periodFromParts(period.year, period.month, 2);
  }
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  return periodFromParts(nextYear, nextMonth, 1);
}

export function previousPeriod(period: FortnightPeriod): FortnightPeriod {
  if (period.half === 2) {
    return periodFromParts(period.year, period.month, 1);
  }
  const prevMonth = period.month === 1 ? 12 : period.month - 1;
  const prevYear = period.month === 1 ? period.year - 1 : period.year;
  return periodFromParts(prevYear, prevMonth, 2);
}

/** "YYYY-MM" of the month the period lives in, as the occurrence endpoints expect. */
export function monthKey(period: FortnightPeriod): string {
  return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

/** "YYYY-MM-DD" -> local midnight. */
export function parseDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    throw new Error(`Invalid date "${value}". Expected YYYY-MM-DD.`);
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Moves a due date from one period into the same relative position of
 * another (a line due on the 5th of Nov 1–15 lands on the 20th of Nov 16–30),
 * clamped to the target window.
 */
export function shiftIntoPeriod(
  date: Date | undefined,
  from: FortnightPeriod,
  to: FortnightPeriod,
): Date | undefined {
  if (!date) return undefined;
  const offsetDays = Math.max(
    0,
    Math.round((startOfDay(date).getTime() - from.start.getTime()) / DAY_MS),
  );
  const candidate = new Date(
    to.start.getFullYear(),
    to.start.getMonth(),
    to.start.getDate() + offsetDays,
  );
  return candidate > to.end ? startOfDay(to.end) : candidate;
}
