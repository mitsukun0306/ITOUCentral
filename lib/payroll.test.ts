import { describe, expect, it } from "vitest";
import type { Task } from "@/lib/generated/prisma";
import { lateInfo, monthRange, taskAmount, taskPayable } from "@/lib/payroll";

const H = 3_600_000;
const due = new Date("2026-11-10T00:00:00+09:00");

function task(overrides: Partial<Task> = {}): Task {
  return {
    fixedReward: 10000,
    unitPrice: 500,
    quantity: 3,
    dueDate: due,
    completedAt: due,
    submittedAt: null,
    penalty24: null,
    penalty72: null,
    penaltyOver: null,
    ...overrides,
  } as Task;
}

describe("taskAmount", () => {
  it("方式ごとに基準額を返す", () => {
    expect(taskAmount(task(), "TASK_FIXED")).toBe(10000);
    expect(taskAmount(task(), "UNIT_QUANTITY")).toBe(1500);
    expect(taskAmount(task(), "MONTHLY_MANUAL")).toBe(0);
  });
});

describe("lateInfo", () => {
  it("期限内・期限なしは減額なし", () => {
    expect(lateInfo(task()).mult).toBe(1);
    expect(lateInfo(task({ dueDate: null })).mult).toBe(1);
  });

  it("既定の減額段階(1/2, 1/3, 0)", () => {
    const at = (ms: number) => task({ completedAt: new Date(due.getTime() + ms) });
    expect(lateInfo(at(24 * H)).mult).toBe(1 / 2);
    expect(lateInfo(at(24 * H + 1)).mult).toBe(1 / 3);
    expect(lateInfo(at(72 * H)).mult).toBe(0);
  });

  it("完了申請時刻(submittedAt)を完了時刻より優先する", () => {
    const t = task({
      submittedAt: due,
      completedAt: new Date(due.getTime() + 100 * H),
    });
    expect(lateInfo(t).mult).toBe(1);
  });

  it("タスクごとの支給率(%)を使う", () => {
    const t = task({
      completedAt: new Date(due.getTime() + H),
      penalty24: 80,
    });
    expect(lateInfo(t)).toEqual({ mult: 0.8, label: "24時間超過(報酬80%)" });
  });
});

describe("taskPayable", () => {
  it("減額後の金額を整数円に切り捨てる", () => {
    const t = task({ completedAt: new Date(due.getTime() + 30 * H) });
    expect(taskPayable(t, "TASK_FIXED")).toBe(3333);
  });
});

describe("monthRange", () => {
  it("JST の月初〜翌月初を返す(12月は年をまたぐ)", () => {
    const [start, end] = monthRange(2026, 12);
    expect(start.toISOString()).toBe("2026-11-30T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T15:00:00.000Z");
  });
});
