import { describe, expect, it } from "vitest";
import { autoBreakMinutes, breakForTimes } from "@/lib/attendance";

describe("autoBreakMinutes", () => {
  it.each([
    [0, 0],
    [4, 15],
    [5.9, 15],
    [6, 60],
    [8, 60],
    [8.5, 120],
    [11, 120],
    [11.1, 180],
  ])("%s時間 → %s分", (hours, minutes) => {
    expect(autoBreakMinutes(hours)).toBe(minutes);
  });

  it("出勤・退勤のどちらかが無ければ 0", () => {
    expect(breakForTimes(null, new Date())).toBe(0);
  });
});
