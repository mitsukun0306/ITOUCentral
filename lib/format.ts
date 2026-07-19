export function yen(amount: number): string {
  return "¥" + amount.toLocaleString("ja-JP");
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("ja-JP", {
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
    hour: "2-digit",
    minute: "2-digit",
  });
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
