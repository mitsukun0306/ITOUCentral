export const JST = "Asia/Tokyo";

export function yen(amount: number): string {
  return "¥" + amount.toLocaleString("ja-JP");
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ja-JP", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("ja-JP", {
    timeZone: JST,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("ja-JP", {
    timeZone: JST,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "YYYY-MM-DD"(JSTの暦日)を、その日の JST 0:00 を指す Date に変換 */
export function jstMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+09:00`);
}

/** Date を JST の暦日 "YYYY-MM-DD" に整形(<input type=date> 用) */
export function toJstDateInput(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 指定時刻(既定は現在)が属する JST の日の 0:00 を返す */
export function jstDayStart(d: Date = new Date()): Date {
  return jstMidnight(toJstDateInput(d));
}

/** 指定時刻(既定は現在)の JST における年・月を返す */
export function jstYearMonth(d: Date = new Date()): {
  year: number;
  month: number;
} {
  const ymd = toJstDateInput(d);
  return { year: Number(ymd.slice(0, 4)), month: Number(ymd.slice(5, 7)) };
}

/** 勤怠の実働時間(時間)を計算 */
export function workHours(
  clockIn: Date | null,
  clockOut: Date | null,
  breakMin: number,
): number {
  if (!clockIn || !clockOut) return 0;
  const ms = clockOut.getTime() - clockIn.getTime();
  const hours = ms / 1000 / 60 / 60 - breakMin / 60;
  return Math.max(0, Math.round(hours * 100) / 100);
}
