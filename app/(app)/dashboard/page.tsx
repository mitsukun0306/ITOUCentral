import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSetting, computePayroll, PAYROLL_METHOD_LABEL } from "@/lib/payroll";
import { yen, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export default async function DashboardPage() {
  const user = await requireUser();
  const setting = await getSetting();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const isAdmin = user.role === "ADMIN";

  // メンバーは自分の、管理者は全体の状況
  const taskWhere = isAdmin ? {} : { assigneeId: user.id };

  const [todo, inProgress, done, myMonthly] = await Promise.all([
    prisma.task.count({ where: { ...taskWhere, status: "TODO" } }),
    prisma.task.count({ where: { ...taskWhere, status: "IN_PROGRESS" } }),
    prisma.task.count({ where: { ...taskWhere, status: "DONE" } }),
    computePayroll(user.id, year, month, setting.defaultPayrollMethod),
  ]);

  const recentTasks = await prisma.task.findMany({
    where: taskWhere,
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: { assignee: { select: { name: true } } },
  });

  // 管理者向け: 今月の見込み総額
  let orgMonthlyTotal = 0;
  if (isAdmin) {
    const members = await prisma.user.findMany({ where: { active: true } });
    const results = await Promise.all(
      members.map((m) =>
        computePayroll(m.id, year, month, setting.defaultPayrollMethod),
      ),
    );
    orgMonthlyTotal = results.reduce((s, r) => s + r.amount, 0);
  }

  // メンバー向け: 確定済報酬実績(今年の確定合計)と 今月末支給額
  let confirmedYearTotal = 0;
  let thisMonthAmount = myMonthly.amount;
  let thisMonthStatus: string | null = null;
  if (!isAdmin) {
    const [agg, savedThisMonth] = await Promise.all([
      prisma.payroll.aggregate({
        where: { userId: user.id, status: "CONFIRMED", year },
        _sum: { amount: true },
      }),
      prisma.payroll.findUnique({
        where: { userId_year_month: { userId: user.id, year, month } },
      }),
    ]);
    confirmedYearTotal = agg._sum.amount ?? 0;
    if (savedThisMonth) {
      thisMonthAmount = savedThisMonth.amount;
      thisMonthStatus = savedThisMonth.status;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">
          {year}年{month}月 ・ {user.name} さん
        </p>
      </div>

      {!isAdmin && (
        <div className="bg-brand text-white rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-sm text-white/80">確定済報酬実績({year}年)</p>
              <p className="text-4xl md:text-5xl font-bold mt-1 tracking-tight">
                {yen(confirmedYearTotal)}
              </p>
            </div>
            <div className="sm:text-right border-t border-white/20 pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
              <p className="text-xs text-white/70">今月末支給額</p>
              <p className="text-xl md:text-2xl font-semibold mt-0.5">
                {yen(thisMonthAmount)}
              </p>
              <p className="text-[11px] text-white/60 mt-0.5">
                {thisMonthStatus === "CONFIRMED" ? "確定済" : "見込み(未確定)"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className={`grid gap-4 ${
          isAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"
        }`}
      >
        <StatCard label="未着手" value={todo} accent="text-gray-700" />
        <StatCard label="進行中" value={inProgress} accent="text-amber-600" />
        <StatCard label="完了" value={done} accent="text-green-600" />
        {isAdmin && (
          <StatCard
            label="今月の見込み総額"
            value={yen(orgMonthlyTotal)}
            accent="text-brand"
          />
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-600">
        現在の給与計算方式:{" "}
        <span className="font-medium text-gray-900">
          {PAYROLL_METHOD_LABEL[setting.defaultPayrollMethod]}
        </span>
        {isAdmin && (
          <>
            {" "}
            <Link href="/settings" className="text-brand hover:underline">
              変更
            </Link>
          </>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">最近のタスク</h2>
          <Link href="/tasks" className="text-sm text-brand hover:underline">
            すべて見る
          </Link>
        </div>
        {recentTasks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            タスクはまだありません
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentTasks.map((t) => (
              <li
                key={t.id}
                className="px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{t.title}</p>
                  <p className="text-xs text-gray-400">
                    {t.assignee?.name ?? "未割当"} ・ 更新{" "}
                    {formatDate(t.updatedAt)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
