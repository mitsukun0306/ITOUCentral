import { prisma } from "@/lib/db";
import type {
  PayrollMethod,
  PayrollStatus,
  Task,
} from "@/lib/generated/prisma";

export const PAYROLL_METHOD_LABEL: Record<PayrollMethod, string> = {
  TASK_FIXED: "タスク固定報酬の合算",
  UNIT_QUANTITY: "単価 × 成果量 の合算",
  MONTHLY_MANUAL: "月次手入力",
};

/** 1タスクの報酬額を、給与計算方式に応じて算出 */
export function taskAmount(task: Task, method: PayrollMethod): number {
  switch (method) {
    case "TASK_FIXED":
      return task.fixedReward;
    case "UNIT_QUANTITY":
      return task.unitPrice * task.quantity;
    case "MONTHLY_MANUAL":
      return 0; // 手入力のため自動計算しない
  }
}

/** 指定年月の [開始, 翌月開始) を返す */
export function monthRange(year: number, month: number): [Date, Date] {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return [start, end];
}

/**
 * 指定ユーザー・年月・方式での成果報酬を、完了タスクから自動集計。
 * MONTHLY_MANUAL の場合は 0(手入力運用)。
 */
export async function computePayroll(
  userId: string,
  year: number,
  month: number,
  method: PayrollMethod,
): Promise<{ amount: number; tasks: Task[] }> {
  if (method === "MONTHLY_MANUAL") {
    return { amount: 0, tasks: [] };
  }

  const [start, end] = monthRange(year, month);
  const tasks = await prisma.task.findMany({
    where: {
      assigneeId: userId,
      status: "DONE",
      OR: [
        // 支給月が明示指定されたタスク
        { payoutYear: year, payoutMonth: month },
        // 支給月未指定のタスクは完了月で計上
        { payoutMonth: null, completedAt: { gte: start, lt: end } },
      ],
    },
    orderBy: { completedAt: "asc" },
  });

  const amount = tasks.reduce((sum, t) => sum + taskAmount(t, method), 0);
  return { amount, tasks };
}

/** 全体設定を取得(なければ作成) */
export async function getSetting() {
  const existing = await prisma.setting.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.setting.create({ data: { id: 1 } });
}

/**
 * メンバーの指定月の支給額を求める(表示用)。
 * - 確定済み: 確定額で固定
 * - 手入力方式: 保存された入力額(なければ 0)
 * - それ以外(未確定のタスクベース): 常に最新のタスク・支給月から再計算
 *   → タスクの支給月変更に即座に追従する。
 */
export async function memberMonthlyPayout(
  userId: string,
  year: number,
  month: number,
  defaultMethod: PayrollMethod,
): Promise<{
  amount: number;
  status: PayrollStatus | null;
  method: PayrollMethod;
}> {
  const saved = await prisma.payroll.findUnique({
    where: { userId_year_month: { userId, year, month } },
  });
  const method = saved?.method ?? defaultMethod;

  if (saved?.status === "CONFIRMED") {
    return { amount: saved.amount, status: "CONFIRMED", method };
  }
  if (method === "MONTHLY_MANUAL") {
    return { amount: saved?.amount ?? 0, status: saved?.status ?? null, method };
  }
  const { amount } = await computePayroll(userId, year, month, method);
  return { amount, status: saved?.status ?? null, method };
}
