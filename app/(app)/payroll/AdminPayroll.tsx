"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import { MonthNav } from "@/components/MonthNav";
import { PAYROLL_METHOD_LABEL, PAYROLL_METHODS } from "@/lib/payroll";
import { yen } from "@/lib/format";
import type { PayrollMethod } from "@/lib/generated/prisma";
import {
  generatePayroll,
  confirmPayroll,
  unconfirmPayroll,
  setPayrollAmount,
  saveDeduction,
  deleteDeduction,
  type ManualState,
  type DeductionState,
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
  deduction: number; // この月の天引き合計
};

type Deduction = {
  id: string;
  userId: string;
  userName: string;
  year: number;
  month: number;
  label: string;
  amount: number;
  note: string | null;
};

/** 項目名の候補(自由入力も可) */
const DEDUCTION_LABELS = [
  "前払い金の精算",
  "立替金の返済",
  "貸与品・備品代",
  "源泉徴収税",
  "振込手数料",
  "その他",
];


export function AdminPayroll({
  year,
  month,
  defaultMethod,
  rows,
  members,
  deductions,
}: {
  year: number;
  month: number;
  defaultMethod: PayrollMethod;
  rows: Row[];
  members: { id: string; name: string }[];
  deductions: Deduction[];
}) {
  const [method, setMethod] = useState<PayrollMethod>(
    defaultMethod === "UNIT_QUANTITY" ? "TASK_FIXED" : defaultMethod,
  );
  const [editing, setEditing] = useState<Row | null>(null);
  // null: 閉じる / "new": 新規 / Deduction: 編集
  const [dedEditing, setDedEditing] = useState<Deduction | "new" | null>(null);
  const [dedError, setDedError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const grossOf = (r: Row) =>
    r.status === "CONFIRMED"
      ? (r.savedAmount ?? r.computedAmount)
      : r.computedAmount;
  const total = rows.reduce((s, r) => s + grossOf(r), 0);
  const deductionTotal = rows.reduce((s, r) => s + r.deduction, 0);
  const confirmedUsers = new Set(
    rows.filter((r) => r.status === "CONFIRMED").map((r) => r.userId),
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
            {PAYROLL_METHODS.map((m) => (
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
                <th className="px-4 py-2 font-medium text-right">報酬額</th>
                <th className="px-4 py-2 font-medium text-right">天引き</th>
                <th className="px-4 py-2 font-medium text-right">
                  差引支給額
                </th>
                <th className="px-4 py-2 font-medium">状態</th>
                <th className="px-4 py-2 font-medium">備考</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const confirmed = r.status === "CONFIRMED";
                // 確定済みは保存額、未確定は常に最新のプレビュー額(食事補助込み)
                const amount = grossOf(r);
                const net = amount - r.deduction;
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
                    <td className="px-4 py-2 text-right text-red-600">
                      {r.deduction > 0 ? `−${yen(r.deduction)}` : "-"}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-semibold ${net < 0 ? "text-red-600" : ""}`}
                    >
                      {yen(net)}
                      {net < 0 && (
                        <span className="block text-[10px] font-normal">
                          天引きが報酬を超えています
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
                <td className="px-4 py-2 text-right text-red-600">
                  {deductionTotal > 0 ? `−${yen(deductionTotal)}` : "-"}
                </td>
                <td className="px-4 py-2 text-right">
                  {yen(total - deductionTotal)}
                </td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">天引き({year}年{month}月)</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              対象給与月の報酬額から差し引かれ、各メンバーの給与タブに表示されます。確定済みの月は変更できません。
            </p>
          </div>
          <button
            onClick={() => {
              setDedError(null);
              setDedEditing("new");
            }}
            className="shrink-0 rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:bg-brand-dark"
          >
            + 天引きを追加
          </button>
        </div>
        {dedError && (
          <p className="mx-4 mt-3 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {dedError}
          </p>
        )}
        {deductions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            この月の天引きはありません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">メンバー</th>
                  <th className="px-4 py-2 font-medium">項目</th>
                  <th className="px-4 py-2 font-medium text-right">
                    天引き額
                  </th>
                  <th className="px-4 py-2 font-medium">備考</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((d) => {
                  const locked = confirmedUsers.has(d.userId);
                  return (
                    <tr key={d.id} className="border-b border-gray-50">
                      <td className="px-4 py-2 font-medium">{d.userName}</td>
                      <td className="px-4 py-2">{d.label}</td>
                      <td className="px-4 py-2 text-right text-red-600 whitespace-nowrap">
                        −{yen(d.amount)}
                      </td>
                      <td className="px-4 py-2 text-gray-500 max-w-[12rem] truncate">
                        {d.note ?? "-"}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {locked ? (
                          <span className="text-xs text-gray-300">確定済み</span>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setDedError(null);
                                setDedEditing(d);
                              }}
                              className="text-brand text-xs hover:underline mr-3"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `${d.userName} の「${d.label}」(${yen(d.amount)})を削除しますか?`,
                                  )
                                )
                                  return;
                                setDedError(null);
                                startTransition(async () => {
                                  const res = await deleteDeduction(d.id);
                                  if (res.error) setDedError(res.error);
                                });
                              }}
                              className="text-red-600 text-xs hover:underline"
                            >
                              削除
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && editing.payrollId && (
        <ManualModal row={editing} onClose={() => setEditing(null)} />
      )}
      {dedEditing && (
        <DeductionModal
          key={dedEditing === "new" ? "new" : dedEditing.id}
          deduction={dedEditing === "new" ? null : dedEditing}
          defaultTarget={`${year}-${String(month).padStart(2, "0")}`}
          members={members}
          onClose={() => setDedEditing(null)}
        />
      )}
    </div>
  );
}

const initialDeduction: DeductionState = {};

function DeductionModal({
  deduction,
  defaultTarget,
  members,
  onClose,
}: {
  deduction: Deduction | null;
  defaultTarget: string;
  members: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(
    saveDeduction,
    initialDeduction,
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const target = deduction
    ? `${deduction.year}-${String(deduction.month).padStart(2, "0")}`
    : defaultTarget;
  // 編集対象が無効化済みメンバーでも選択肢に残す
  const options =
    deduction && !members.some((m) => m.id === deduction.userId)
      ? [...members, { id: deduction.userId, name: deduction.userName }]
      : members;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">
            {deduction ? "天引きを編集" : "天引きを追加"}
          </h2>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ×
          </button>
        </div>
        <form action={action} className="p-5 space-y-4">
          {deduction && <input type="hidden" name="id" value={deduction.id} />}
          <label className="block">
            <span className="block text-sm font-medium mb-1">メンバー</span>
            <select
              name="userId"
              required
              defaultValue={deduction?.userId ?? ""}
              className={inputCls}
            >
              <option value="" disabled>
                選択してください
              </option>
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">対象給与月</span>
            <input
              name="target"
              type="month"
              required
              defaultValue={target}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">項目名</span>
            <input
              name="label"
              required
              maxLength={50}
              list="deduction-labels"
              defaultValue={deduction?.label ?? ""}
              placeholder="例: 前払い金の精算"
              className={inputCls}
            />
            <datalist id="deduction-labels">
              {DEDUCTION_LABELS.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">天引き額(円)</span>
            <input
              name="amount"
              type="number"
              required
              min={1}
              step={1}
              defaultValue={deduction?.amount ?? ""}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">
              備考(メンバーにも表示されます)
            </span>
            <input
              name="note"
              maxLength={200}
              defaultValue={deduction?.note ?? ""}
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
