"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  clockIn,
  clockOut,
  editAttendance,
  type AttendanceFormState,
} from "./actions";
import { formatDate, formatTime, workHours } from "@/lib/format";

type Rec = {
  id: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakMin: number;
  note: string | null;
};

type Member = { id: string; name: string };

export function AttendancePanel({
  isAdmin,
  isSelf,
  members,
  selectedMember,
  today,
  records,
}: {
  isAdmin: boolean;
  isSelf: boolean;
  members: Member[];
  selectedMember: string;
  today: { id: string; clockIn: string | null; clockOut: string | null } | null;
  records: Rec[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Rec | null>(null);
  const [, startTransition] = useTransition();

  const totalHours = records.reduce(
    (s, r) =>
      s +
      workHours(
        r.clockIn ? new Date(r.clockIn) : null,
        r.clockOut ? new Date(r.clockOut) : null,
        r.breakMin,
      ),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">勤怠</h1>
        {isAdmin && (
          <select
            value={selectedMember}
            onChange={(e) =>
              router.push(`/attendance?member=${e.target.value}`)
            }
            className="text-sm border border-gray-300 rounded-lg px-3 py-2"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isSelf && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-3">本日の打刻</p>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-sm">
              <span className="text-gray-400">出勤</span>{" "}
              <span className="font-semibold text-lg">
                {formatTime(today?.clockIn)}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-400">退勤</span>{" "}
              <span className="font-semibold text-lg">
                {formatTime(today?.clockOut)}
              </span>
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => startTransition(() => clockIn())}
                className="rounded-lg bg-green-600 text-white px-5 py-2 text-sm font-medium hover:bg-green-700"
              >
                出勤
              </button>
              <button
                onClick={() => startTransition(() => clockOut())}
                className="rounded-lg bg-gray-800 text-white px-5 py-2 text-sm font-medium hover:bg-gray-900"
              >
                退勤
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">今月の記録</h2>
          <span className="text-sm text-gray-500">
            合計実働 {totalHours.toFixed(1)} 時間
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2 font-medium">日付</th>
                <th className="px-4 py-2 font-medium">出勤</th>
                <th className="px-4 py-2 font-medium">退勤</th>
                <th className="px-4 py-2 font-medium">休憩</th>
                <th className="px-4 py-2 font-medium">実働</th>
                <th className="px-4 py-2 font-medium">メモ</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    今月の記録はありません
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-4 py-2">{formatDate(r.workDate)}</td>
                    <td className="px-4 py-2">{formatTime(r.clockIn)}</td>
                    <td className="px-4 py-2">{formatTime(r.clockOut)}</td>
                    <td className="px-4 py-2">{r.breakMin}分</td>
                    <td className="px-4 py-2">
                      {workHours(
                        r.clockIn ? new Date(r.clockIn) : null,
                        r.clockOut ? new Date(r.clockOut) : null,
                        r.breakMin,
                      ).toFixed(1)}
                      h
                    </td>
                    <td className="px-4 py-2 text-gray-500 max-w-[12rem] truncate">
                      {r.note ?? "-"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => setEditing(r)}
                        className="text-brand text-xs hover:underline"
                      >
                        編集
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditModal rec={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

const initial: AttendanceFormState = {};

function EditModal({ rec, onClose }: { rec: Rec; onClose: () => void }) {
  const [state, action, pending] = useActionState(editAttendance, initial);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const toHHMM = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">{formatDate(rec.workDate)} の勤怠</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ×
          </button>
        </div>
        <form action={action} className="p-5 space-y-4">
          <input type="hidden" name="id" value={rec.id} />
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1">出勤</span>
              <input
                type="time"
                name="clockIn"
                defaultValue={toHHMM(rec.clockIn)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">退勤</span>
              <input
                type="time"
                name="clockOut"
                defaultValue={toHHMM(rec.clockOut)}
                className={inputCls}
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium mb-1">休憩(分)</span>
            <input
              type="number"
              name="breakMin"
              min={0}
              defaultValue={rec.breakMin}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">メモ</span>
            <input
              name="note"
              defaultValue={rec.note ?? ""}
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
