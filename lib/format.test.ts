import { describe, expect, it } from "vitest";
import { jstYearMonth, toJstDateInput, workHours, yen } from "@/lib/format";
import { rankFor } from "@/lib/rank";

describe("format", () => {
  it("yen は円記号と桁区切りを付ける", () => {
    expect(yen(1234567)).toBe("¥1,234,567");
  });

  it("JST の暦日で日付を扱う(UTC 15:00 以降は翌日)", () => {
    const d = new Date("2026-11-30T15:30:00Z");
    expect(toJstDateInput(d)).toBe("2026-12-01");
    expect(jstYearMonth(d)).toEqual({ year: 2026, month: 12 });
  });

  it("workHours は休憩を引き、マイナスにならない", () => {
    const a = new Date("2026-11-01T00:00:00Z");
    const b = new Date("2026-11-01T09:00:00Z");
    expect(workHours(a, b, 60)).toBe(8);
    expect(workHours(a, a, 60)).toBe(0);
  });
});

describe("rankFor", () => {
  it("しきい値は「以下」で判定する", () => {
    expect(rankFor(10000).key).toBe("BRONZE");
    expect(rankFor(10001).key).toBe("SILVER");
    expect(rankFor(10_000_000).key).toBe("RAINBOW");
  });
});
