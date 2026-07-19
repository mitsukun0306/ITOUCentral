import { MonthNav } from "@/components/MonthNav";
import { PAYROLL_METHOD_LABEL } from "@/lib/payroll";
import { yen } from "@/lib/format";
import type { PayrollMethod } from "@/lib/generated/prisma";

function rowAmount(t: TaskRow, method: PayrollMethod): number {
  if (method === "UNIT_QUANTITY") return t.unitPrice * t.quantity;
  return t.fixedReward;
}

type TaskRow = {
  id: string;
  title: string;
  fixedReward: number;
  unitPrice: number;
  quantity: number;
};

export function MemberPayroll({
  year,
  month,
  method,
  amount,
  status,
  note,
  tasks,
}: {
  year: number;
  month: number;
  method: PayrollMethod;
  amount: number;
  status: string | null;
  note: string | null;
  tasks: TaskRow[];
}) {
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
        <p className="text-4xl font-bold text-brand mt-2">{yen(amount)}</p>
        <p className="text-xs text-gray-400 mt-2">
          計算方式: {PAYROLL_METHOD_LABEL[method]}
        </p>
        {note && <p className="text-sm text-gray-600 mt-2">備考: {note}</p>}
      </div>

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
                      {method === "UNIT_QUANTITY" && (
                        <span className="text-xs text-gray-400 ml-2">
                          {yen(t.unitPrice)} × {t.quantity}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {yen(rowAmount(t, method))}
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
