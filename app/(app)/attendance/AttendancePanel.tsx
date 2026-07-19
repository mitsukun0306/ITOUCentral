"use client";

import { useState, useTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  clockIn,
  clockOut,
  editAttendance,
  approveAttendanceEdit,
  rejectAttendanceEdit,
  createAttendance,
  deleteAttendance,
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
  editRequested: boolean;
  reqClockIn: string | null;
  reqClockOut: string | null;
  reqNote: string | null;
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
  const [showAdd, setShowAdd] = useState(false);
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
          <div className="flex items-center gap-2">
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
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-dark whitespace-nowrap"
            >
              + 勤怠を追加
            </button>
          </div>
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
          <p className="text-xs text-gray-400 mt-3">
            休憩は勤務時間に応じて自動計算されます。時刻の修正は「編集」から
            {isAdmin ? "行えます。" : "管理者へ申請できます。"}
          </p>
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
                  <RecordRows
                    key={r.id}
                    r={r}
                    isAdmin={isAdmin}
                    onEdit={() => setEditing(r)}
                    onApprove={() =>
                      startTransition(() => approveAttendanceEdit(r.id))
                    }
                    onReject={() =>
                      startTransition(() => rejectAttendanceEdit(r.id))
                    }
                    onDelete={() => {
                      if (confirm("この勤怠記録を削除しますか?"))
                        startTransition(() => deleteAttendance(r.id));
                    }}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditModal
          rec={editing}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
        />
      )}
      {showAdd && isAdmin && (
        <AddModal
          members={members}
          selectedMember={selectedMember}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function RecordRows({
  r,
  isAdmin,
  onEdit,
  onApprove,
  onReject,
  onDelete,
}: {
  r: Rec;
  isAdmin: boolean;
  onEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const hhmm = (iso: string | null) => (iso ? formatTime(iso) : "-");
  return (
    <>
      <tr className="border-b border-gray-50">
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
          {r.editRequested && (
            <span className="ml-2 inline-block text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 align-middle">
              変更申請中
            </span>
          )}
        </td>
        <td className="px-4 py-2 text-right whitespace-nowrap">
          <button
            onClick={onEdit}
            className="text-brand text-xs hover:underline"
          >
            編集
          </button>
          {isAdmin && (
            <button
              onClick={onDelete}
              className="text-red-500 text-xs hover:underline ml-3"
            >
              削除
            </button>
          )}
        </td>
      </tr>
      {r.editRequested && (
        <tr className="bg-blue-50/60 border-b border-blue-100">
          <td colSpan={7} className="px-4 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-blue-800">
              <span className="font-medium">変更申請の内容:</span>
              <span>出勤 {hhmm(r.reqClockIn)}</span>
              <span>退勤 {hhmm(r.reqClockOut)}</span>
              {r.reqNote && <span>メモ「{r.reqNote}」</span>}
              {isAdmin ? (
                <span className="ml-auto flex gap-2">
                  <button
                    onClick={onApprove}
                    className="rounded-md bg-green-600 text-white px-3 py-1 hover:bg-green-700"
                  >
                    承認
                  </button>
                  <button
                    onClick={onReject}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1 text-gray-600 hover:bg-gray-50"
                  >
                    却下
                  </button>
                </span>
              ) : (
                <span className="ml-auto text-blue-600">承認待ち</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const initial: AttendanceFormState = {};

function EditModal({
  rec,
  isAdmin,
  onClose,
}: {
  rec: Rec;
  isAdmin: boolean;
  onClose: () => void;
}) {
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
          <h2 className="font-semibold">
            {formatDate(rec.workDate)} の勤怠{isAdmin ? "を編集" : "の変更を申請"}
          </h2>
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
          {isAdmin && (
            <label className="block">
              <span className="block text-sm font-medium mb-1">
                休憩(分)
              </span>
              <input
                type="number"
                name="breakMin"
                min={0}
                defaultValue={rec.breakMin}
                className={inputCls}
              />
            </label>
          )}
          <label className="block">
            <span className="block text-sm font-medium mb-1">メモ</span>
            <input
              name="note"
              defaultValue={rec.note ?? ""}
              className={inputCls}
            />
          </label>
          <p className="text-xs text-gray-400">
            {isAdmin
              ? "休憩は空にせず値を入れてください(既定は自動計算値)。"
              : "休憩時間は勤務時間から自動計算されます。この変更は管理者の承認後に反映されます。"}
          </p>
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
              {pending ? "送信中..." : isAdmin ? "保存" : "変更を申請"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddModal({
  members,
  selectedMember,
  onClose,
}: {
  members: Member[];
  selectedMember: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(createAttendance, initial);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold">勤怠を追加</h2>
          <button onClick={onClose} className="text-gray-400 text-xl">
            ×
          </button>
        </div>
        <form action={action} className="p-5 space-y-4">
          <label className="block">
            <span className="block text-sm font-medium mb-1">対象者</span>
            <select
              name="userId"
              defaultValue={selectedMember}
              className={inputCls}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">日付</span>
            <input
              type="date"
              name="workDate"
              defaultValue={todayStr}
              className={inputCls}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium mb-1">出勤</span>
              <input type="time" name="clockIn" className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium mb-1">退勤</span>
              <input type="time" name="clockOut" className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className="block text-sm font-medium mb-1">
              休憩(分・空欄で自動計算)
            </span>
            <input
              type="number"
              name="breakMin"
              min={0}
              placeholder="自動"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium mb-1">メモ</span>
            <input name="note" className={inputCls} />
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

const inputCls =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand";
