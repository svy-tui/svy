// 日付文字列（YYYY-MM-DD）の演算。タイムゾーンの影響を受けないようUTC固定で計算する。

const DAY_MS = 86400000;

export function addDays(date: string, delta: number): string | undefined {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return undefined;
  return new Date(t + delta * DAY_MS).toISOString().slice(0, 10);
}

/** a - b を日数で返す */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS);
}

/** ローカルタイムゾーンでの今日 */
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
