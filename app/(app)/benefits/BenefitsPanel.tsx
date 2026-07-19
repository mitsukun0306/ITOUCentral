"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import {
  createRetreatEvent,
  deleteRetreatEvent,
  submitExpense,
  approveExpense,
  rejectExpense,
  deleteExpense,
  submitMeal,
  deleteMeal,
  type EventFormState,
  type ExpenseFormState,
  type MealFormState,
} from "./actions";
import { yen, formatDate } from "@/lib/format";
import { RankBadge } from "@/components/RankBadge";
import type { MealAllowance } from "@/lib/payroll";
import type { ExpenseStatus } from "@/lib/generated/prisma";

type MealDTO = {
  id: string;
  date: string;
  amount: number;
  item: string;
  place: string;
};

type EventDTO = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string;
  endDate: string | null;
  upcoming: boolean;
};

type ExpenseDTO = {
  id: string;
  userName: string;
  title: string;
  amount: number;
  category: string | null;
  incurredOn: string | null;
  note: string | null;
  status: ExpenseStatus;
  createdAt: string;
};

const EXPENSE_STATUS: Record<
  ExpenseStatus,
  { label: string; cls: string }
> = {
  PENDING: { label: "承認待ち", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "承認済み", cls: "bg-green-100 text-green-700" },
  REJECTED: { label: "却下", cls: "bg-red-100 text-red-700" },
};

export function BenefitsPanel({
  isAdmin,
  events,
  expenses,
  year,
  month,
  meals,
  mealInfo,
}: {
  isAdmin: boolean;
  events: EventDTO[];
  expenses: ExpenseDTO[];
  year: number;
  month: number;
  meals: MealDTO[];
  mealInfo: MealAllowance;
}) {
  const [showEvent, setShowEvent] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">福利厚生</h1>
        <p className="text-sm text-gray-500 mt-1">
          リトリートイベントの予定と、経費申請を行えます。
        </p>
      </div>

      {/* リトリートイベント */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">🌴 リトリートイベント</h2>
          {isAdmin && (
            <button
              onClick={() => setShowEvent(true)}
              className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-dark"
            >
              + イベントを追加
            </button>
          )}
        </div>

        {events.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
            予定されているイベントはありません
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {events.map((e) => (
              <div
                key={e.id}
                className={`rounded-xl border p-4 ${
                  e.upcoming
                    ? "bg-white border-gray-200"
                    : "bg-gray-50 border-gray-100 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{e.title}</h3>
                      {e.upcoming ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                          開催予定
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                          終了
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(e.startDate)}
                      {e.endDate && ` 〜 ${formatDate(e.endDate)}`}
                      {e.location && ` ・ ${e.location}`}
                    </p>
                    {e.description && (
                      <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">
                        {e.description}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm("このイベントを削除しますか?"))
                          startTransition(() => deleteRetreatEvent(e.id));
                      }}
                      className="text-red-500 text-xs hover:underline shrink-0"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 経費申請 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">💳 経費申請</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <ExpenseForm />
          <div className="lg:col-span-2">
            <ExpenseList
              isAdmin={isAdmin}
              expenses={expenses}
              onApprove={(id) =>
                startTransition(() => approveExpense(id))
              }
              onReject={(id) => startTransition(() => rejectExpense(id))}
              onDelete={(id) => {
                if (confirm("この申請を削除しますか?"))
                  startTransition(() => deleteExpense(id));
              }}
            />
          </div>
        </div>
      </section>

      {/* 食事補助 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">🍱 食事補助</h2>
        <MealSummary year={year} month={month} info={mealInfo} />
        <div className="grid gap-4 lg:grid-cols-3">
          <MealForm year={year} month={month} />
          <div className="lg:col-span-2">
            <MealList
              meals={meals}
              onDelete={(id) => {
                if (confirm("この食事記録を削除しますか?"))
                  startTransition(() => deleteMeal(id));
              }}
            />
          </div>
        </div>
      </section>

      {showEvent && isAdmin && (
        <EventModal onClose={() => setShowEvent(false)} />
      )}
    </div>
  );
}

function MealSummary({
  year,
  month,
  info,
}: {
  year: number;
  month: number;
  info: MealAllowance;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">あなたのランク</p>
          <RankBadge rankKey={info.rankKey} size="sm" />
        </div>
        <Metric label={`${month}月の申請日数`} value={`${info.days} 日`} />
        <Metric label="申請合計" value={yen(info.total)} />
        <Metric label="月限度額" value={yen(info.limit)} />
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-500">今月の食事補助(報酬に加算)</p>
          <p className="text-2xl font-bold text-brand">
            {yen(info.allowance)}
          </p>
          <p className="text-[11px] mt-0.5">
            {info.eligible ? (
              <span className="text-green-600">支給対象(10日以上)</span>
            ) : (
              <span className="text-amber-600">
                あと {Math.max(0, 10 - info.days)} 日で支給対象
              </span>
            )}
          </p>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        月10日以上、食費・食べたもの・場所を申請すると、ランクの限度額内で申請額が報酬に加算されます({year}年{month}月)。
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}

const mealInitial: MealFormState = {};

function MealForm({ year, month }: { year: number; month: number }) {
  const [state, action, pending] = useActionState(submitMeal, mealInitial);
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state.ok) setFormKey((k) => k + 1);
  }, [state.ok]);

  const defaultDate = `${year}-${String(month).padStart(2, "0")}-${String(
    new Date().getDate(),
  ).padStart(2, "0")}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
      <h3 className="font-semibold mb-3">食費を申請</h3>
      <form key={formKey} action={action} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium mb-1">
              日付 <span className="text-red-500">*</span>
            </span>
            <input
              type="date"
              name="date"
              defaultValue={defaultDate}
              required
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">
              金額(円) <span className="text-red-500">*</span>
            </span>
            <input
              type="number"
              name="amount"
              min={1}
              required
              className={inputCls}
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-medium mb-1">
            食べたもの <span className="text-red-500">*</span>
          </span>
          <input
            name="item"
            required
            placeholder="例: 定食ランチ"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">
            場所 <span className="text-red-500">*</span>
          </span>
          <input
            name="place"
            required
            placeholder="例: 〇〇食堂"
            className={inputCls}
          />
        </label>
        {state.error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
            申請しました。
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand text-white py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "申請中..." : "申請する"}
        </button>
      </form>
    </div>
  );
}

function MealList({
  meals,
  onDelete,
}: {
  meals: MealDTO[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold">今月の食事記録</h3>
      </div>
      {meals.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">
          まだ記録がありません
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {meals.map((m) => (
            <li
              key={m.id}
              className="px-4 py-2.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {m.item}
                  <span className="ml-2 font-semibold text-brand">
                    {yen(m.amount)}
                  </span>
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(m.date)} ・ {m.place}
                </p>
              </div>
              <button
                onClick={() => onDelete(m.id)}
                className="text-red-500 text-xs hover:underline shrink-0"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const eventInitial: EventFormState = {};

function EventModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(
    createRetreatEvent,
    eventInitial,
  );
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">リトリートイベントを追加</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ×
          </button>
        </div>
        <form action={action} className="p-5 space-y-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1">
              タイトル <span className="text-red-500">*</span>
            </span>
            <input name="title" required className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1">
                開始日 <span className="text-red-500">*</span>
              </span>
              <input type="date" name="startDate" required className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">終了日</span>
              <input type="date" name="endDate" className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium mb-1">場所</span>
            <input
              name="location"
              placeholder="例: 沖縄・恩納村"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">詳細</span>
            <textarea name="description" rows={3} className={inputCls} />
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
              {pending ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const expenseInitial: ExpenseFormState = {};

function ExpenseForm() {
  const [state, action, pending] = useActionState(
    submitExpense,
    expenseInitial,
  );
  // 送信成功でフォームをリセットするため key を更新
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state.ok) setFormKey((k) => k + 1);
  }, [state.ok]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
      <h3 className="font-semibold mb-3">経費を申請</h3>
      <form key={formKey} action={action} className="space-y-3">
        <label className="block">
          <span className="block text-sm font-medium mb-1">
            件名 <span className="text-red-500">*</span>
          </span>
          <input
            name="title"
            required
            placeholder="例: 書籍購入"
            className={inputCls}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium mb-1">
              金額(円) <span className="text-red-500">*</span>
            </span>
            <input
              name="amount"
              type="number"
              min={1}
              required
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">発生日</span>
            <input type="date" name="incurredOn" className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-medium mb-1">カテゴリ</span>
          <input
            name="category"
            placeholder="例: 交通費 / 備品"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-1">備考</span>
          <textarea name="note" rows={2} className={inputCls} />
        </label>
        {state.error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">
            申請しました。承認をお待ちください。
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand text-white py-2 text-sm font-medium hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "申請中..." : "申請する"}
        </button>
      </form>
    </div>
  );
}

function ExpenseList({
  isAdmin,
  expenses,
  onApprove,
  onReject,
  onDelete,
}: {
  isAdmin: boolean;
  expenses: ExpenseDTO[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="font-semibold">
          {isAdmin ? "申請一覧(全員)" : "自分の申請"}
        </h3>
      </div>
      {expenses.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">
          申請はまだありません
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {expenses.map((x) => {
            const s = EXPENSE_STATUS[x.status];
            return (
              <li key={x.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{x.title}</span>
                      <span className="font-semibold text-brand">
                        {yen(x.amount)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${s.cls}`}
                      >
                        {s.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 mt-1">
                      {isAdmin && <span>申請者: {x.userName}</span>}
                      {x.category && <span>{x.category}</span>}
                      {x.incurredOn && (
                        <span>発生日: {formatDate(x.incurredOn)}</span>
                      )}
                      <span>申請: {formatDate(x.createdAt)}</span>
                    </div>
                    {x.note && (
                      <p className="text-sm text-gray-500 mt-1">{x.note}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isAdmin && x.status === "PENDING" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onApprove(x.id)}
                          className="rounded-md bg-green-600 text-white px-3 py-1 text-xs hover:bg-green-700"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => onReject(x.id)}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          却下
                        </button>
                      </div>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => onDelete(x.id)}
                        className="text-red-500 text-xs hover:underline"
                      >
                        削除
                      </button>
                    )}
                    {!isAdmin && x.status === "PENDING" && (
                      <button
                        onClick={() => onDelete(x.id)}
                        className="text-red-500 text-xs hover:underline"
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";
