"use client";

import { useActionState } from "react";
import { updateSetting, type SettingState } from "./actions";
import { PAYROLL_METHOD_LABEL } from "@/lib/payroll";
import type { PayrollMethod } from "@/lib/generated/prisma";

const METHODS: PayrollMethod[] = [
  "TASK_FIXED",
  "UNIT_QUANTITY",
  "MONTHLY_MANUAL",
];

const METHOD_DESC: Record<PayrollMethod, string> = {
  TASK_FIXED: "完了タスクに設定した固定報酬を合算して給与を算出します。",
  UNIT_QUANTITY: "完了タスクの「単価 × 成果量」を合算して給与を算出します。",
  MONTHLY_MANUAL: "自動計算せず、管理者が月ごとに金額を手入力して確定します。",
};

const initial: SettingState = {};

export function SettingsForm({
  companyName,
  defaultPayrollMethod,
}: {
  companyName: string;
  defaultPayrollMethod: PayrollMethod;
}) {
  const [state, action, pending] = useActionState(updateSetting, initial);

  return (
    <form
      action={action}
      className="bg-white rounded-xl border border-gray-200 p-6 space-y-5"
    >
      <label className="block">
        <span className="block text-sm font-medium mb-1">組織名</span>
        <input
          name="companyName"
          defaultValue={companyName}
          className={inputCls}
        />
      </label>

      <div>
        <span className="block text-sm font-medium mb-2">
          既定の給与計算方式
        </span>
        <div className="space-y-2">
          {METHODS.map((m) => (
            <label
              key={m}
              className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50"
            >
              <input
                type="radio"
                name="defaultPayrollMethod"
                value={m}
                defaultChecked={m === defaultPayrollMethod}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">
                  {PAYROLL_METHOD_LABEL[m]}
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {METHOD_DESC[m]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
          保存しました
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand text-white px-5 py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";
