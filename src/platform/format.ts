import { cleanName, NAME_MAX } from "@shared/name.ts";

const numberFormat = new Intl.NumberFormat("ja-JP");

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatDuration(ms: number): string {
  const tenths = Math.round(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths % 10}`;
}

/** 秒の差を「↑ 3.2 秒」のように出すための値 */
export function durationDelta(ms: number): number {
  return Math.round(ms / 100) / 10;
}

function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatPlayedAt(at: number, now: number): string {
  const date = new Date(at);
  const today = startOfDay(now);
  if (at >= today) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (at >= yesterday.getTime()) return "昨日";
  if (date.getFullYear() === new Date(now).getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
}

export function nameLengthHint(input: string): string {
  const rest = NAME_MAX - Array.from(cleanName(input)).length;
  return rest >= 0 ? `あと ${rest} 字` : `${-rest} 字多い`;
}
