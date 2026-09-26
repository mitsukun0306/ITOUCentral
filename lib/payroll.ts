import { prisma } from "@/lib/db";
import { toJstDateInput } from "@/lib/format";
import { rankFor, MEAL_LIMIT, type RankKey } from "@/lib/rank";
import type {
  PayrollMethod,
  PayrollStatus,
  Task,
} from "@/lib/generated/prisma";

/** その年の確定済報酬実績(確定済み給与の合計) */
export async function confirmedYearTotal(
  userId: string,
  year: number,
): Promise<number> {
  const agg = await prisma.payroll.aggregate({
    where: { userId, status: "CONFIRMED", year },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

export type MealAllowance = {
  rankKey: RankKey;
  rankLabel: string;
  limit: number;
  days: number; // 申請した日数(重複日は1)
  total: number; // 申請合計額
  eligible: boolean; // 月10日以上か
  allowance: number; // 実際に報酬へ加算される額
};

/** 指定月の食事補助額を算出(月10日以上でランク限度額まで支給) */
export async function mealAllowanceForMonth(
  userId: string,
  year: number,
  month: number,
): Promise<MealAllowance> {
  const rank = rankFor(await confirmedYearTotal(userId, year));
  const limit = MEAL_LIMIT[rank.key];
  const [start, end] = monthRange(year, month);
  const records = await prisma.mealRecord.findMany({
    where: { userId, date: { gte: start, lt: end }, status: "APPROVED" },
    select: { date: true, amount: true },
  });
  const dayset = new Set(records.map((r) => toJstDateInput(r.date)));
  const days = dayset.size;
  const total = records.reduce((s, r) => s + r.amount, 0);
  const eligible = days >= 10;
  const allowance = eligible ? Math.min(total, limit) : 0;
  return {
    rankKey: rank.key,
    rankLabel: rank.label,
    limit,
    days,
    total,
    eligible,
    allowance,
  };
}

export const PAYROLL_METHOD_LABEL: Record<PayrollMethod, string> = {
  TASK_FIXED: "タスク固定報酬の合算",
  UNIT_QUANTITY: "単価 × 成果量 の合算",
  MONTHLY_MANUAL: "月次手入力",
};

/** 1タスクの報酬額(減額前の基準額)を、給与計算方式に応じて算出 */
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

export type PenaltyTask = {
  dueDate: Date | null;
  completedAt: Date | null;
  submittedAt?: Date | null;
  penalty24?: number | null;
  penalty72?: number | null;
  penaltyOver?: number | null;
};

/** タスクの各段階の支給率(0〜1)。未設定なら既定(1/2, 1/3, 0)。 */
export function penaltyRates(task: PenaltyTask): {
  r24: number;
  r72: number;
  rOver: number;
} {
  return {
    r24: task.penalty24 == null ? 1 / 2 : task.penalty24 / 100,
    r72: task.penalty72 == null ? 1 / 3 : task.penalty72 / 100,
    rOver: task.penaltyOver == null ? 0 : task.penaltyOver / 100,
  };
}

/**
 * 納品(完了)遅延による報酬倍率。段階はタスクごとに管理者が設定可能。
 * - 期限内 / 期限なし: ×1
 * - 超過24時間以内 / 3日未満 / 3日以降: タスク設定(既定 1/2 / 1/3 / 0)
 */
export function lateInfo(task: PenaltyTask): {
  mult: number;
  label: string | null;
} {
  // 納品時刻 = 完了申請した時刻(仮確定)を優先。なければ完了時刻。
  const deliver = task.submittedAt ?? task.completedAt;
  if (!task.dueDate || !deliver) return { mult: 1, label: null };
  const late = deliver.getTime() - task.dueDate.getTime();
  if (late <= 0) return { mult: 1, label: null };
  const H = 3_600_000;
  const { r24, r72, rOver } = penaltyRates(task);
  const pct = (r: number) => `${Math.round(r * 100)}%`;
  if (late <= 24 * H)
    return { mult: r24, label: `24時間超過(報酬${pct(r24)})` };
  if (late < 72 * H)
    return { mult: r72, label: `3日未満超過(報酬${pct(r72)})` };
  return { mult: rOver, label: `3日以上超過(報酬${pct(rOver)})` };
}

/** 遅延減額を反映した実支給の報酬額(整数円・切り捨て) */
export function taskPayable(task: Task, method: PayrollMethod): number {
  return Math.floor(taskAmount(task, method) * lateInfo(task).mult);
}

/** 指定年月(JST)の [開始, 翌月開始) を JST 基準で返す */
export function monthRange(year: number, month: number): [Date, Date] {
  const p = (n: number) => String(n).padStart(2, "0");
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const start = new Date(`${year}-${p(month)}-01T00:00:00+09:00`);
  const end = new Date(`${ny}-${p(nm)}-01T00:00:00+09:00`);
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

  const amount = tasks.reduce((sum, t) => sum + taskPayable(t, method), 0);
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
 * - 確定済み: 確定額で固定(確定時に食事補助も含めて凍結)
 * - 手入力方式: 保存された入力額(食事補助は管理者が手入力に含める運用)
 * - それ以外(未確定のタスクベース): 最新のタスク・支給月から再計算 + 食事補助
 *   → タスクの支給月変更や食事補助の申請に即座に追従する。
 */
export async function memberMonthlyPayout(
  userId: string,
  year: number,
  month: number,
  defaultMethod: PayrollMethod,
): Promise<{
  amount: number;
  base: number;
  meal: number;
  status: PayrollStatus | null;
  method: PayrollMethod;
}> {
  const saved = await prisma.payroll.findUnique({
    where: { userId_year_month: { userId, year, month } },
  });
  const method = saved?.method ?? defaultMethod;

  if (saved?.status === "CONFIRMED") {
    return {
      amount: saved.amount,
      base: saved.amount,
      meal: 0,
      status: "CONFIRMED",
      method,
    };
  }
  if (method === "MONTHLY_MANUAL") {
    const base = saved?.amount ?? 0;
    return { amount: base, base, meal: 0, status: saved?.status ?? null, method };
  }
  const { amount: base } = await computePayroll(userId, year, month, method);
  const { allowance: meal } = await mealAllowanceForMonth(userId, year, month);
  return {
    amount: base + meal,
    base,
    meal,
    status: saved?.status ?? null,
    method,
  };
}
