"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { breakForTimes } from "@/lib/attendance";

/** その日の0時(ローカル)を返す */
function dayStart(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("権限がありません");
  return user;
}

function revalidateAll() {
  revalidatePath("/attendance");
  revalidatePath("/notifications");
}

export async function clockIn() {
  const user = await requireUser();
  const workDate = dayStart();
  const now = new Date();
  const existing = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: user.id, workDate } },
  });
  const breakMin = breakForTimes(now, existing?.clockOut ?? null);
  await prisma.attendance.upsert({
    where: { userId_workDate: { userId: user.id, workDate } },
    update: { clockIn: now, breakMin },
    create: { userId: user.id, workDate, clockIn: now, breakMin },
  });
  revalidateAll();
}

export async function clockOut() {
  const user = await requireUser();
  const workDate = dayStart();
  const now = new Date();
  const existing = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: user.id, workDate } },
  });
  const breakMin = breakForTimes(existing?.clockIn ?? null, now);
  await prisma.attendance.upsert({
    where: { userId_workDate: { userId: user.id, workDate } },
    update: { clockOut: now, breakMin },
    create: { userId: user.id, workDate, clockOut: now, breakMin },
  });
  revalidateAll();
}

const editSchema = z.object({
  id: z.string(),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  note: z.string().optional(),
});

export type AttendanceFormState = {
  error?: string;
  ok?: boolean;
  requested?: boolean;
};

/**
 * 勤怠時刻の編集。
 * - 管理者: 即時反映(休憩は自動再計算)。
 * - メンバー: 変更申請として保存(実際の時刻は変えず、管理者の承認待ち)。
 */
export async function editAttendance(
  _prev: AttendanceFormState,
  formData: FormData,
): Promise<AttendanceFormState> {
  const user = await requireUser();
  const parsed = editSchema.safeParse({
    id: formData.get("id"),
    clockIn: formData.get("clockIn") || undefined,
    clockOut: formData.get("clockOut") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "入力エラー" };

  const rec = await prisma.attendance.findUnique({
    where: { id: parsed.data.id },
  });
  if (!rec) return { error: "記録が見つかりません" };

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && rec.userId !== user.id) {
    return { error: "権限がありません" };
  }

  const base = rec.workDate;
  const toDateTime = (hhmm?: string): Date | null => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
  };
  const newIn = toDateTime(parsed.data.clockIn);
  const newOut = toDateTime(parsed.data.clockOut);
  const newNote = parsed.data.note ?? null;

  if (isAdmin) {
    // 即時反映(休憩は自動計算)。申請中だった場合は同時にクリア。
    await prisma.attendance.update({
      where: { id: rec.id },
      data: {
        clockIn: newIn,
        clockOut: newOut,
        note: newNote,
        breakMin: breakForTimes(newIn, newOut),
        editRequested: false,
        reqClockIn: null,
        reqClockOut: null,
        reqNote: null,
        reqAt: null,
      },
    });
    revalidateAll();
    return { ok: true };
  }

  // メンバー: 変更申請として保存(実際の時刻は変更しない)
  await prisma.attendance.update({
    where: { id: rec.id },
    data: {
      editRequested: true,
      reqClockIn: newIn,
      reqClockOut: newOut,
      reqNote: newNote,
      reqAt: new Date(),
    },
  });
  revalidateAll();
  return { ok: true, requested: true };
}

/** 管理者: メンバーの変更申請を承認(申請内容を反映) */
export async function approveAttendanceEdit(id: string) {
  await requireAdmin();
  const rec = await prisma.attendance.findUnique({ where: { id } });
  if (!rec) throw new Error("記録が見つかりません");
  if (!rec.editRequested) throw new Error("申請がありません");

  await prisma.attendance.update({
    where: { id },
    data: {
      clockIn: rec.reqClockIn,
      clockOut: rec.reqClockOut,
      note: rec.reqNote,
      breakMin: breakForTimes(rec.reqClockIn, rec.reqClockOut),
      editRequested: false,
      reqClockIn: null,
      reqClockOut: null,
      reqNote: null,
      reqAt: null,
    },
  });
  revalidateAll();
}

/** 管理者: 変更申請を却下(申請内容を破棄) */
export async function rejectAttendanceEdit(id: string) {
  await requireAdmin();
  await prisma.attendance.update({
    where: { id },
    data: {
      editRequested: false,
      reqClockIn: null,
      reqClockOut: null,
      reqNote: null,
      reqAt: null,
    },
  });
  revalidateAll();
}
