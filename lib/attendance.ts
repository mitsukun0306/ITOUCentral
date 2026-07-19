/**
 * 勤務時間(拘束時間 = 出勤〜退勤)から休憩時間(分)を自動算出する。
 *
 * ルール:
 *  - 4時間以下                : 15分
 *  - 4時間超〜6時間未満        : 15分(規定なしのため暫定。要確認)
 *  - 6時間以上〜8時間以下      : 60分
 *  - 8時間を超える場合         : 60分 + 8時間を超えた分に対し「3時間ごとに+60分」
 *      例) 8h超〜11h → 120分 / 11h超〜14h → 180分 / 14h超〜17h → 240分
 */
export function autoBreakMinutes(spanHours: number): number {
  if (spanHours <= 0) return 0;
  if (spanHours < 6) return 15; // 4時間以下・4〜6時間
  if (spanHours <= 8) return 60; // 6〜8時間
  const over = spanHours - 8;
  const extraBlocks = Math.ceil(over / 3); // 超過分を3時間ごとに切り上げ
  return 60 + extraBlocks * 60;
}

/** 出勤・退勤時刻から自動休憩(分)。どちらか欠けていれば 0。 */
export function breakForTimes(
  clockIn: Date | null,
  clockOut: Date | null,
): number {
  if (!clockIn || !clockOut) return 0;
  const spanHours = (clockOut.getTime() - clockIn.getTime()) / 3_600_000;
  return autoBreakMinutes(spanHours);
}
