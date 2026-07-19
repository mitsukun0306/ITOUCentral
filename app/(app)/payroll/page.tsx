import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getSetting,
  computePayroll,
  memberMonthlyPayout,
  mealAllowanceForMonth,
} from "@/lib/payroll";
import { AdminPayroll } from "./AdminPayroll";
import { MemberPayroll } from "./MemberPayroll";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? Number(params.year) : now.getFullYear();
  const month = params.month ? Number(params.month) : now.getMonth() + 1;
  const setting = await getSetting();

  if (user.role === "ADMIN") {
    const members = await prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    const rows = await Promise.all(
      members.map(async (m) => {
        const saved = await prisma.payroll.findUnique({
          where: { userId_year_month: { userId: m.id, year, month } },
        });
        // 保存済みならその方式、なければ現在の既定方式でプレビュー計算
        const method = saved?.method ?? setting.defaultPayrollMethod;
        const { amount: base } = await computePayroll(m.id, year, month, method);
        // タスクベース方式は食事補助を上乗せしてプレビュー
        const { allowance: meal } =
          method === "MONTHLY_MANUAL"
            ? { allowance: 0 }
            : await mealAllowanceForMonth(m.id, year, month);
        const computed = base + meal;
        return {
          userId: m.id,
          name: m.name,
          payrollId: saved?.id ?? null,
          method,
          savedAmount: saved?.amount ?? null,
          computedAmount: computed,
          status: saved?.status ?? null,
          note: saved?.note ?? null,
        };
      }),
    );

    return (
      <AdminPayroll
        year={year}
        month={month}
        defaultMethod={setting.defaultPayrollMethod}
        rows={rows}
      />
    );
  }

  // メンバー: 自分の給与
  const saved = await prisma.payroll.findUnique({
    where: { userId_year_month: { userId: user.id, year, month } },
  });
  const method = saved?.method ?? setting.defaultPayrollMethod;
  // 表示額は未確定なら最新のタスク・支給月から再計算(支給月変更に追従)
  const payout = await memberMonthlyPayout(
    user.id,
    year,
    month,
    setting.defaultPayrollMethod,
  );
  const { tasks } = await computePayroll(user.id, year, month, method);

  return (
    <MemberPayroll
      year={year}
      month={month}
      method={method}
      amount={payout.amount}
      status={payout.status}
      note={saved?.note ?? null}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        fixedReward: t.fixedReward,
        unitPrice: t.unitPrice,
        quantity: t.quantity,
      }))}
    />
  );
}
