import { MonthNav } from "@/components/MonthNav";
import { PAYROLL_METHOD_LABEL, netPay } from "@/lib/payroll";
import { yen } from "@/lib/format";
import type { PayrollMethod } from "@/lib/generated/prisma";

type TaskRow = {
  id: string;
  title: string;
  rewardLabel: string; // 報酬方式
  detail: string; // 内訳(例: 手付金 ¥10,000 + ¥3,000 × 5)
  base: number; // 減額前
  payable: number; // 減額後(実支給)
  penaltyLabel: string | null;
};

type DeductionRow = {
  id: string;
  label: string;
  amount: number;
  note: string | null;
};

export function MemberPayroll({
  year,
  month,
  method,
  amount,
  status,
  note,
  deductionTotal,
  deductions,
  tasks,
}: {
  year: number;
  month: number;
  method: PayrollMethod;
  amount: number;
  status: string | null;
  note: string | null;
  deductionTotal: number;
  deductions: DeductionRow[];
  tasks: TaskRow[];
}) {
  const net = netPay(amount, deductionTotal);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">給与</h1>
        <MonthNav year={year} month={month} basePath="/payroll" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-500">
          {year}年{month}月の報酬
          {status === "CONFIRMED" ? (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              確定
            </span>
          ) : (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              見込み(未確定)
            </span>
          )}
        </p>
        <p className="text-4xl font-bold text-brand mt-2">{yen(net)}</p>
        {deductionTotal > 0 && (
          <p className="text-sm text-gray-500 mt-2">
            報酬 {yen(amount)}
            <span className="text-red-600 ml-2">
              − 天引き {yen(deductionTotal)}
            </span>
            <span className="ml-2">= 差引支給額 {yen(net)}</span>
          </p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          計算方式: {PAYROLL_METHOD_LABEL[method]}
        </p>
        {note && <p className="text-sm text-gray-600 mt-2">備考: {note}</p>}
      </div>

      {deductions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold">天引き</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">項目</th>
                <th className="px-4 py-2 font-medium text-right">天引き額</th>
              </tr>
            </thead>
            <tbody>
              {deductions.map((d) => (
                <tr key={d.id} className="border-b border-gray-50">
                  <td className="px-4 py-2">
                    {d.label}
                    {d.note && (
                      <span className="block text-[11px] text-gray-400 mt-0.5">
                        {d.note}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-red-600 whitespace-nowrap">
                    −{yen(d.amount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-2">合計</td>
                <td className="px-4 py-2 text-right text-red-600">
                  −{yen(deductionTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {method !== "MONTHLY_MANUAL" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold">対象の完了タスク</h2>
          </div>
          {tasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              この月に完了したタスクはありません
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">タスク</th>
                  <th className="px-4 py-2 font-medium text-right">報酬</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="px-4 py-2">
                      {t.title}
                      <span className="block text-[11px] text-gray-400 mt-0.5">
                        {t.rewardLabel}: {t.detail}
                      </span>
                      {t.penaltyLabel && (
                        <span className="block text-[11px] text-red-600 mt-0.5">
                          遅延減額: {t.penaltyLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium whitespace-nowrap">
                      {t.penaltyLabel ? (
                        <>
                          <span className="text-gray-400 line-through mr-2 font-normal">
                            {yen(t.base)}
                          </span>
                          <span className="text-red-600">{yen(t.payable)}</span>
                        </>
                      ) : (
                        yen(t.payable)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
