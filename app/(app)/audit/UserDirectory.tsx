import { prisma } from "@/lib/db";
import {
  getSetting,
  memberMonthlyPayout,
  PAYROLL_METHOD_LABEL,
} from "@/lib/payroll";
import { rankFor, MEAL_LIMIT } from "@/lib/rank";
import { yen, formatDate, jstYearMonth } from "@/lib/format";
import { RankBadge } from "@/components/RankBadge";

/**
 * 監査タブ用: 全ユーザーの登録情報と集計値の一覧(管理者専用ページから呼ぶ)。
 * passwordHash など認証用の値は select しない。
 */
export async function UserDirectory() {
  const { year, month } = jstYearMonth();
  const setting = await getSetting();

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const [confirmed, tasks, expenses, meals, attendance, payouts] =
    await Promise.all([
      prisma.payroll.groupBy({
        by: ["userId"],
        where: { status: "CONFIRMED", year },
        _sum: { amount: true },
      }),
      prisma.task.groupBy({
        by: ["assigneeId", "status"],
        where: { assigneeId: { not: null } },
        _count: { _all: true },
      }),
      prisma.expenseRequest.groupBy({
        by: ["userId", "status"],
        _count: { _all: true },
      }),
      prisma.mealRecord.groupBy({
        by: ["userId", "status"],
        _count: { _all: true },
      }),
      prisma.attendance.groupBy({
        by: ["userId"],
        _count: { _all: true },
        _max: { workDate: true },
      }),
      Promise.all(
        users.map((u) =>
          memberMonthlyPayout(u.id, year, month, setting.defaultPayrollMethod),
        ),
      ),
    ]);

  const confirmedBy = new Map(
    confirmed.map((c) => [c.userId, c._sum.amount ?? 0]),
  );
  const attendanceBy = new Map(attendance.map((a) => [a.userId, a]));
  const countOf = (
    rows: { _count: { _all: number }; status: string }[],
    status?: string,
  ) =>
    rows
      .filter((r) => !status || r.status === status)
      .reduce((s, r) => s + r._count._all, 0);

  const rows = users.map((u, i) => {
    const yearTotal = confirmedBy.get(u.id) ?? 0;
    const rank = rankFor(yearTotal);
    const t = tasks.filter((r) => r.assigneeId === u.id);
    const e = expenses.filter((r) => r.userId === u.id);
    const m = meals.filter((r) => r.userId === u.id);
    const a = attendanceBy.get(u.id);
    return {
      ...u,
      yearTotal,
      rank,
      mealLimit: MEAL_LIMIT[rank.key],
      payout: payouts[i],
      tasks: {
        total: countOf(t),
        open: countOf(t, "TODO") + countOf(t, "IN_PROGRESS"),
        review: countOf(t, "REVIEW"),
        done: countOf(t, "DONE"),
      },
      expenses: {
        total: countOf(e),
        pending: countOf(e, "PENDING"),
        approved: countOf(e, "APPROVED"),
      },
      meals: {
        total: countOf(m),
        pending: countOf(m, "PENDING"),
        approved: countOf(m, "APPROVED"),
      },
      attendanceDays: a?._count._all ?? 0,
      lastWorkDate: a?._max.workDate ?? null,
    };
  });

  const th = "px-3 py-2 font-medium whitespace-nowrap";
  const td = "px-3 py-2 whitespace-nowrap";

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-bold">ユーザー一覧</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          全ユーザーの登録情報とランク・実績({year}年{month}月時点、全{" "}
          {users.length} 名)
        </p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className={th}>名前</th>
                <th className={th}>メール</th>
                <th className={th}>権限</th>
                <th className={th}>状態</th>
                <th className={th}>ランク</th>
                <th className={`${th} text-right`}>
                  確定済報酬実績({year}年)
                </th>
                <th className={`${th} text-right`}>食事補助 月限度額</th>
                <th className={`${th} text-right`}>今月支給額</th>
                <th className={th}>給与方式</th>
                <th className={th}>タスク</th>
                <th className={th}>経費申請</th>
                <th className={th}>食事補助申請</th>
                <th className={th}>勤怠</th>
                <th className={th}>登録日</th>
                <th className={th}>更新日</th>
                <th className={th}>ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 align-top">
                  <td className={`${td} font-medium`}>{r.name}</td>
                  <td className={`${td} text-gray-600`}>{r.email}</td>
                  <td className={td}>
                    {r.role === "ADMIN" ? "管理者" : "メンバー"}
                  </td>
                  <td className={td}>
                    {r.active ? (
                      <span className="text-green-700">有効</span>
                    ) : (
                      <span className="text-gray-400">無効</span>
                    )}
                  </td>
                  <td className={td}>
                    <RankBadge rankKey={r.rank.key} size="sm" />
                  </td>
                  <td className={`${td} text-right`}>{yen(r.yearTotal)}</td>
                  <td className={`${td} text-right`}>{yen(r.mealLimit)}</td>
                  <td className={`${td} text-right`}>
                    {yen(r.payout.amount)}
                    <div className="text-[11px] text-gray-400">
                      {r.payout.status === "CONFIRMED" ? "確定済" : "見込み"}
                      {r.payout.meal > 0 && ` ・食事補助 ${yen(r.payout.meal)}`}
                    </div>
                  </td>
                  <td className={`${td} text-gray-600`}>
                    {PAYROLL_METHOD_LABEL[r.payout.method]}
                  </td>
                  <td className={td}>
                    計{r.tasks.total}
                    <div className="text-[11px] text-gray-400">
                      未完了{r.tasks.open} ・申請中{r.tasks.review} ・完了
                      {r.tasks.done}
                    </div>
                  </td>
                  <td className={td}>
                    計{r.expenses.total}
                    <div className="text-[11px] text-gray-400">
                      承認待ち{r.expenses.pending} ・承認{r.expenses.approved}
                    </div>
                  </td>
                  <td className={td}>
                    計{r.meals.total}
                    <div className="text-[11px] text-gray-400">
                      承認待ち{r.meals.pending} ・承認{r.meals.approved}
                    </div>
                  </td>
                  <td className={td}>
                    {r.attendanceDays}日
                    <div className="text-[11px] text-gray-400">
                      最終 {formatDate(r.lastWorkDate)}
                    </div>
                  </td>
                  <td className={`${td} text-gray-500`}>
                    {formatDate(r.createdAt)}
                  </td>
                  <td className={`${td} text-gray-500`}>
                    {formatDate(r.updatedAt)}
                  </td>
                  <td className={`${td} text-gray-400 font-mono text-xs`}>
                    {r.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
