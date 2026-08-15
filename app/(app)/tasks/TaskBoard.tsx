"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import {
  upsertTask,
  updateTaskStatus,
  deleteTask,
  type TaskFormState,
} from "./actions";
import { StatusBadge } from "@/components/StatusBadge";
import { Countdown } from "@/components/Countdown";
import { yen, formatDate, toJstDateInput } from "@/lib/format";
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
  penalty24: number | null;
  penalty72: number | null;
  penaltyOver: number | null;
  dueDate: string | null;
  submittedAt: string | null;
  provisionalReward: number | null;
  penaltyLabel: string | null;
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

// メンバーが行える前進遷移のみ(戻し不可)
const MEMBER_NEXT: Partial<Record<TaskStatus, TaskStatus>> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "REVIEW",
};

/**
 * 色付きのステータス切替ボタン群。
 * - 管理者: 4状態を自由に変更。
 * - メンバー: 現在の状態(表示のみ)+ 前進できる次の1手のみ。未着手への差し戻し不可。
 */
function StatusButtons({
  status,
  isAdmin,
  onChange,
}: {
  status: TaskStatus;
  isAdmin: boolean;
  onChange: (s: TaskStatus) => void;
}) {
  const btn = (s: TaskStatus, label: string, active: boolean, clickable: boolean) => (
    <button
      key={s}
      type="button"
      aria-pressed={active}
      disabled={!clickable}
      onClick={() => clickable && onChange(s)}
      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
        active
          ? STATUS_ACTIVE_CLS[s]
          : clickable
            ? "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            : "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
      }`}
    >
      {label}
    </button>
  );

  if (isAdmin) {
    const options: TaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"];
    return (
      <div className="flex flex-wrap gap-1.5">
        {options.map((s) => btn(s, STATUS_LABEL[s], status === s, status !== s))}
      </div>
    );
  }

  // メンバー: 現在の状態 + 次の1手のみ
  const next = MEMBER_NEXT[status];
  return (
    <div className="flex flex-wrap gap-1.5">
      {btn(status, STATUS_LABEL[status], true, false)}
      {next &&
        btn(
          next,
          next === "REVIEW" ? "完了申請" : STATUS_LABEL[next],
          false,
          true,
        )}
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
  const [consentTask, setConsentTask] = useState<TaskDTO | null>(null);
  const [, startTransition] = useTransition();

  // 期限超過判定用の時刻(クライアント確定後にのみ有効化しハイドレーション不一致を回避)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  // 期限超過の派手な演出は「未着手・進行中」の未納品タスクのみ(申請済みは一時停止)
  const isOverdue = (t: TaskDTO) =>
    now !== null &&
    (t.status === "TODO" || t.status === "IN_PROGRESS") &&
    !!t.dueDate &&
    new Date(t.dueDate).getTime() <= now;

  // ステータス変更。メンバーの「未着手→進行中」は同意事項を挟む。
  const handleStatusChange = (t: TaskDTO, s: TaskStatus) => {
    if (!isAdmin && t.status === "TODO" && s === "IN_PROGRESS") {
      setConsentTask(t);
      return;
    }
    startTransition(() => updateTaskStatus(t.id, s));
  };

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
              <li
                key={t.id}
                className={`px-4 py-3 ${isOverdue(t) ? "task-overdue" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-medium ${
                          isOverdue(t) ? "text-red-700" : ""
                        }`}
                      >
                        {t.title}
                      </span>
                      <StatusBadge status={t.status} />
                      {isOverdue(t) && (
                        <span className="text-[11px] font-bold text-red-700">
                          ⚠ 期限超過
                        </span>
                      )}
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
                      {t.dueDate && (
                        <span className="inline-flex items-center gap-1.5">
                          期限: {formatDate(t.dueDate)}{" "}
                          <span className="text-gray-500">0:00</span>
                          <Countdown
                            dueIso={t.dueDate}
                            done={t.status === "DONE"}
                            frozenIso={
                              t.status === "REVIEW" ? t.submittedAt : null
                            }
                          />
                        </span>
                      )}
                      {t.payoutYear && t.payoutMonth && (
                        <span className="text-brand">
                          支給月: {t.payoutYear}/{t.payoutMonth}
                        </span>
                      )}
                    </div>

                    {t.status === "REVIEW" && t.provisionalReward !== null && (
                      <p className="text-[12px] mt-2 inline-block rounded-md bg-blue-50 text-blue-700 px-2 py-1">
                        仮確定報酬: <b>{yen(t.provisionalReward)}</b>
                        {t.penaltyLabel && (
                          <span className="text-red-600 ml-1">
                            ({t.penaltyLabel})
                          </span>
                        )}
                        <span className="text-blue-400 ml-1">
                          ・期限カウント停止中
                        </span>
                      </p>
                    )}

                    {canEditStatus(t) && (
                      <div className="mt-2.5">
                        <StatusButtons
                          status={t.status}
                          isAdmin={isAdmin}
                          onChange={(s) => handleStatusChange(t, s)}
                        />
                        {!isAdmin && t.status === "REVIEW" && (
                          <p className="text-[11px] text-blue-600 mt-1">
                            完了申請中です。管理者の承認をお待ちください(取り消し不可)。
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

      {consentTask && (
        <ConsentModal
          task={consentTask}
          onCancel={() => setConsentTask(null)}
          onAgree={() => {
            const id = consentTask.id;
            setConsentTask(null);
            startTransition(() => updateTaskStatus(id, "IN_PROGRESS"));
          }}
        />
      )}
    </div>
  );
}

function ConsentModal({
  task,
  onAgree,
  onCancel,
}: {
  task: TaskDTO;
  onAgree: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold">着手前の同意事項</h2>
          <p className="text-xs text-gray-500 mt-1">「{task.title}」を開始します</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-gray-700 space-y-2">
            <p className="font-medium text-amber-800">
              以下に同意のうえ着手してください。
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <b>期限(納品期日)を必ず厳守</b>します。期限はその日の 0:00
                です。
              </li>
              <li>
                <b>いかなる理由があっても期限超過は認められません。</b>
                超過した場合は規定に従い報酬が減額(超過24時間以内は原則1/2、3日未満は1/3、3日以降は0)されることに同意します。
              </li>
              <li>
                一度着手すると<b>「未着手」へ戻すことはできません。</b>
              </li>
              <li>
                完了申請を行った時点で<b>報酬が仮確定</b>し、期限カウントが停止します。申請後の取り消しはできません。
              </li>
            </ul>
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span>上記の内容をすべて確認し、同意します。</span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="button"
              disabled={!checked}
              onClick={onAgree}
              className="px-4 py-2 text-sm rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
            >
              同意して進行中にする
            </button>
          </div>
        </div>
      </div>
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
    task?.dueDate ? toJstDateInput(task.dueDate) : "",
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

          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-3">
            <p className="text-xs text-gray-500">
              納品遅延時の支給率(%)。空欄なら既定(24h:50 / 3日未満:33 / 3日以降:0)。
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="超過24h以内">
                <input
                  name="penalty24"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="50"
                  defaultValue={task?.penalty24 ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="超過3日未満">
                <input
                  name="penalty72"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="33"
                  defaultValue={task?.penalty72 ?? ""}
                  className={inputCls}
                />
              </Field>
              <Field label="超過3日以降">
                <input
                  name="penaltyOver"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="0"
                  defaultValue={task?.penaltyOver ?? ""}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>

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
