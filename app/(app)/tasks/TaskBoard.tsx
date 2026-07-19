"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import {
  upsertTask,
  updateTaskStatus,
  deleteTask,
  type TaskFormState,
} from "./actions";
import { StatusBadge } from "@/components/StatusBadge";
import { yen, formatDate } from "@/lib/format";
import type { TaskStatus } from "@/lib/generated/prisma";

type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  fixedReward: number;
  unitPrice: number;
  quantity: number;
  payoutYear: number | null;
  payoutMonth: number | null;
  dueDate: string | null;
};

type Member = { id: string; name: string };

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "未着手",
  IN_PROGRESS: "進行中",
  REVIEW: "完了申請中",
  DONE: "完了",
};

// 色付き切替ボタンの見た目(選択中の配色)
const STATUS_ACTIVE_CLS: Record<TaskStatus, string> = {
  TODO: "bg-gray-500 border-gray-500 text-white",
  IN_PROGRESS: "bg-amber-500 border-amber-500 text-white",
  REVIEW: "bg-blue-500 border-blue-500 text-white",
  DONE: "bg-green-600 border-green-600 text-white",
};

/** 色付きのステータス切替ボタン群。メンバーは完了(DONE)を選べず、代わりに完了申請(REVIEW)まで。 */
function StatusButtons({
  status,
  isAdmin,
  onChange,
}: {
  status: TaskStatus;
  isAdmin: boolean;
  onChange: (s: TaskStatus) => void;
}) {
  const options: TaskStatus[] = isAdmin
    ? ["TODO", "IN_PROGRESS", "REVIEW", "DONE"]
    : ["TODO", "IN_PROGRESS", "REVIEW"];

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((s) => {
        const active = status === s;
        // メンバー視点では REVIEW ボタンは「完了申請」というアクション表記にする
        let label = STATUS_LABEL[s];
        if (!isAdmin && s === "REVIEW") label = active ? "申請中" : "完了申請";
        return (
          <button
            key={s}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) onChange(s);
            }}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              active
                ? STATUS_ACTIVE_CLS[s]
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function TaskBoard({
  isAdmin,
  currentUserId,
  tasks,
  members,
}: {
  isAdmin: boolean;
  currentUserId: string;
  tasks: TaskDTO[];
  members: Member[];
}) {
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<TaskStatus | "ALL">("ALL");
  const [, startTransition] = useTransition();

  const visible = tasks.filter((t) => filter === "ALL" || t.status === filter);

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (t: TaskDTO) => {
    setEditing(t);
    setShowForm(true);
  };

  const canEditStatus = (t: TaskDTO) =>
    isAdmin || t.assigneeId === currentUserId;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">タスク</h1>
        {isAdmin && (
          <button
            onClick={openNew}
            className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-dark"
          >
            + 新規タスク
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {(["ALL", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-sm px-3 py-1.5 rounded-lg border ${
              filter === s
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {s === "ALL" ? "すべて" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {visible.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">
            該当するタスクはありません
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {visible.map((t) => (
              <li key={t.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{t.title}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    {t.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 mt-1.5">
                      <span>担当: {t.assigneeName ?? "未割当"}</span>
                      {t.fixedReward > 0 && (
                        <span>固定報酬: {yen(t.fixedReward)}</span>
                      )}
                      {t.unitPrice > 0 && (
                        <span>
                          単価 {yen(t.unitPrice)} × {t.quantity} ={" "}
                          {yen(t.unitPrice * t.quantity)}
                        </span>
                      )}
                      {t.dueDate && <span>期限: {formatDate(t.dueDate)}</span>}
                      {t.payoutYear && t.payoutMonth && (
                        <span className="text-brand">
                          支給月: {t.payoutYear}/{t.payoutMonth}
                        </span>
                      )}
                    </div>

                    {canEditStatus(t) && (
                      <div className="mt-2.5">
                        <StatusButtons
                          status={t.status}
                          isAdmin={isAdmin}
                          onChange={(s) =>
                            startTransition(() => updateTaskStatus(t.id, s))
                          }
                        />
                        {!isAdmin && t.status === "REVIEW" && (
                          <p className="text-[11px] text-blue-600 mt-1">
                            完了申請中です。管理者の承認をお待ちください。
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {t.status === "REVIEW" && (
                        <span className="text-[11px] text-blue-600 font-medium">
                          承認待ち
                        </span>
                      )}
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={() => openEdit(t)}
                          className="text-brand hover:underline"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("このタスクを削除しますか?"))
                              startTransition(() => deleteTask(t.id));
                          }}
                          className="text-red-500 hover:underline"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && isAdmin && (
        <TaskFormModal
          task={editing}
          members={members}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

const initialState: TaskFormState = {};

function TaskFormModal({
  task,
  members,
  onClose,
}: {
  task: TaskDTO | null;
  members: Member[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(upsertTask, initialState);

  const [due, setDue] = useState(
    task?.dueDate ? task.dueDate.slice(0, 10) : "",
  );
  const [payout, setPayout] = useState(
    task?.payoutYear && task?.payoutMonth
      ? `${task.payoutYear}-${String(task.payoutMonth).padStart(2, "0")}`
      : "",
  );

  // 支給月の候補: 期限の月(未設定なら今月)から2ヶ月先まで
  const base = due
    ? new Date(Number(due.slice(0, 4)), Number(due.slice(5, 7)) - 1, 1)
    : new Date();
  const payoutOptions = Array.from({ length: 3 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    return { value: `${y}-${String(m).padStart(2, "0")}`, label: `${y}年${m}月` };
  });

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">
            {task ? "タスクを編集" : "新規タスク"}
          </h2>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ×
          </button>
        </div>
        <form action={formAction} className="p-5 space-y-4">
          {task && <input type="hidden" name="id" value={task.id} />}

          <Field label="タイトル" required>
            <input
              name="title"
              required
              defaultValue={task?.title ?? ""}
              className={inputCls}
            />
          </Field>

          <Field label="説明">
            <textarea
              name="description"
              rows={2}
              defaultValue={task?.description ?? ""}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="担当者">
              <select
                name="assigneeId"
                defaultValue={task?.assigneeId ?? ""}
                className={inputCls}
              >
                <option value="">未割当</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="ステータス">
              <select
                name="status"
                defaultValue={task?.status ?? "TODO"}
                className={inputCls}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-3">
            <p className="text-xs text-gray-500">
              報酬の入力(給与計算方式に応じて使われます)
            </p>
            <Field label="固定報酬(円)">
              <input
                name="fixedReward"
                type="number"
                min={0}
                defaultValue={task?.fixedReward ?? 0}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="単価(円)">
                <input
                  name="unitPrice"
                  type="number"
                  min={0}
                  defaultValue={task?.unitPrice ?? 0}
                  className={inputCls}
                />
              </Field>
              <Field label="成果量">
                <input
                  name="quantity"
                  type="number"
                  min={0}
                  defaultValue={task?.quantity ?? 0}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="期限">
              <input
                name="dueDate"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="支給月">
              <select
                name="payoutMonth"
                value={payout}
                onChange={(e) => setPayout(e.target.value)}
                className={inputCls}
              >
                <option value="">自動(完了月に計上)</option>
                {payoutOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                {payout && !payoutOptions.some((o) => o.value === payout) && (
                  <option value={payout}>{payout}(現在の設定)</option>
                )}
              </select>
            </Field>
          </div>
          <p className="text-xs text-gray-400 -mt-2">
            支給月は期限の月から2ヶ月先まで選べます。未指定なら完了した月に計上されます。
          </p>

          {state.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
