"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import { MonthNav } from "@/components/MonthNav";
import { PAYROLL_METHOD_LABEL } from "@/lib/payroll";
import { yen } from "@/lib/format";
import type { PayrollMethod } from "@/lib/generated/prisma";
import {
  generatePayroll,
  confirmPayroll,
  unconfirmPayroll,
  setPayrollAmount,
  type ManualState,
} from "./actions";

type Row = {
  userId: string;
  name: string;
  payrollId: string | null;
  method: PayrollMethod;
  savedAmount: number | null;
  computedAmount: number;
  status: string | null;
  note: string | null;
};

const METHODS: PayrollMethod[] = [
  "TASK_FIXED",
  "UNIT_QUANTITY",
  "MONTHLY_MANUAL",
];

export function AdminPayroll({
  year,
  month,
  defaultMethod,
  rows,
}: {
  year: number;
  month: number;
  defaultMethod: PayrollMethod;
  rows: Row[];
}) {
  const [method, setMethod] = useState<PayrollMethod>(defaultMethod);
  const [editing, setEditing] = useState<Row | null>(null);
  const [, startTransition] = useTransition();

  const total = rows.reduce(
    (s, r) =>
      s +
      (r.status === "CONFIRMED"
        ? (r.savedAmount ?? r.computedAmount)
        : r.computedAmount),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">給与(管理)</h1>
        <MonthNav year={year} month={month} basePath="/payroll" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">計算方式</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PayrollMethod)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYROLL_METHOD_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <form
          action={(fd) => {
            fd.set("year", String(year));
            fd.set("month", String(month));
            fd.set("method", method);
            startTransition(() => generatePayroll(fd));
          }}
        >
          <button
            type="submit"
            className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-dark"
          >
            この月の給与を計算・保存
          </button>
        </form>
        <p className="text-xs text-gray-400 ml-auto self-center">
          ※確定済みの行は上書きされません
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">メンバー</th>
                <th className="px-4 py-2 font-medium">方式</th>
                <th className="px-4 py-2 font-medium text-right">金額</th>
                <th className="px-4 py-2 font-medium">状態</th>
                <th className="px-4 py-2 font-medium">備考</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const confirmed = r.status === "CONFIRMED";
                // 確定済みは保存額、未確定は常に最新のプレビュー額(食事補助込み)
                const amount = confirmed
                  ? (r.savedAmount ?? r.computedAmount)
                  : r.computedAmount;
                return (
                  <tr key={r.userId} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {PAYROLL_METHOD_LABEL[r.method]}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {yen(amount)}
                      {r.savedAmount === null && (
                        <span className="block text-[10px] text-gray-400 font-normal">
                          未保存(見込み)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {confirmed ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          確定
                        </span>
                      ) : r.status === "DRAFT" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          下書き
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500 max-w-[10rem] truncate">
                      {r.note ?? "-"}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {r.payrollId && !confirmed && (
                        <>
                          <button
                            onClick={() => setEditing(r)}
                            className="text-brand text-xs hover:underline mr-3"
                          >
                            編集
                          </button>
                          <button
                            onClick={() =>
                              startTransition(() =>
                                confirmPayroll(r.payrollId!),
                              )
                            }
                            className="text-green-600 text-xs hover:underline"
                          >
                            確定
                          </button>
                        </>
                      )}
                      {r.payrollId && confirmed && (
                        <button
                          onClick={() =>
                            startTransition(() =>
                              unconfirmPayroll(r.payrollId!),
                            )
                          }
                          className="text-gray-500 text-xs hover:underline"
                        >
                          確定解除
                        </button>
                      )}
                      {!r.payrollId && (
                        <span className="text-xs text-gray-300">
                          未計算
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-2" colSpan={2}>
                  合計
                </td>
                <td className="px-4 py-2 text-right">{yen(total)}</td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {editing && editing.payrollId && (
        <ManualModal row={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

const initial: ManualState = {};

function ManualModal({ row, onClose }: { row: Row; onClose: () => void }) {
  const [state, action, pending] = useActionState(setPayrollAmount, initial);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">{row.name} の給与を編集</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ×
          </button>
        </div>
        <form action={action} className="p-5 space-y-4">
          <input type="hidden" name="id" value={row.payrollId!} />
          <label className="block">
            <span className="block text-sm font-medium mb-1">金額(円)</span>
            <input
              name="amount"
              type="number"
              min={0}
              defaultValue={row.savedAmount ?? row.computedAmount}
              className={inputCls}
            />
            {row.method !== "MONTHLY_MANUAL" && (
              <span className="block text-xs text-gray-400 mt-1">
                自動計算値: {yen(row.computedAmount)}
              </span>
            )}
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">備考</span>
            <input
              name="note"
              defaultValue={row.note ?? ""}
              className={inputCls}
            />
          </label>
          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-sm rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {pending ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";
