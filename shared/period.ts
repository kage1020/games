export const PERIODS = ["today", "week", "all"] as const;
export type Period = (typeof PERIODS)[number];

const JST_OFFSET = 9 * 3_600_000;
const DAY = 86_400_000;

export function isPeriod(value: string): value is Period {
  return (PERIODS as readonly string[]).includes(value);
}

export function periodStart(period: Period, now: number): number {
  if (period === "all") return 0;
  const dayStart = Math.floor((now + JST_OFFSET) / DAY) * DAY;
  if (period === "today") return dayStart - JST_OFFSET;
  const sinceMonday = (new Date(dayStart).getUTCDay() + 6) % 7;
  return dayStart - sinceMonday * DAY - JST_OFFSET;
}
