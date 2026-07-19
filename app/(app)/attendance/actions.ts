"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
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
  await logAudit(user, "出勤打刻");
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
  await logAudit(user, "退勤打刻");
  revalidateAll();
}

const editSchema = z.object({
  id: z.string(),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  note: z.string().optional(),
  // 管理者のみ: 休憩を手動指定(未指定なら自動計算)
  breakMin: z.coerce.number().int().min(0).optional(),
});

/** "HH:MM" を対象日の DateTime に変換 */
function timeOnDate(base: Date, hhmm?: string | null): Date | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
}

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
  const rawBreak = formData.get("breakMin");
  const parsed = editSchema.safeParse({
    id: formData.get("id"),
    clockIn: formData.get("clockIn") || undefined,
    clockOut: formData.get("clockOut") || undefined,
    note: formData.get("note") || undefined,
    breakMin: rawBreak !== null && rawBreak !== "" ? rawBreak : undefined,
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
  const newIn = timeOnDate(base, parsed.data.clockIn);
  const newOut = timeOnDate(base, parsed.data.clockOut);
  const newNote = parsed.data.note ?? null;

  if (isAdmin) {
    // 即時反映。休憩は手動指定があればそれを、なければ自動計算。
    const breakMin =
      parsed.data.breakMin !== undefined
        ? parsed.data.breakMin
        : breakForTimes(newIn, newOut);
    await prisma.attendance.update({
      where: { id: rec.id },
      data: {
        clockIn: newIn,
        clockOut: newOut,
        note: newNote,
        breakMin,
        editRequested: false,
        reqClockIn: null,
        reqClockOut: null,
        reqNote: null,
        reqAt: null,
      },
    });
    await logAudit(user, "勤怠編集", rec.workDate.toLocaleDateString("ja-JP"));
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
  await logAudit(
    user,
    "勤怠変更申請",
    rec.workDate.toLocaleDateString("ja-JP"),
  );
  revalidateAll();
  return { ok: true, requested: true };
}

/** 管理者: メンバーの変更申請を承認(申請内容を反映) */
export async function approveAttendanceEdit(id: string) {
  const admin = await requireAdmin();
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
  await logAudit(
    admin,
    "勤怠変更を承認",
    rec.workDate.toLocaleDateString("ja-JP"),
  );
  revalidateAll();
}

/** 管理者: 変更申請を却下(申請内容を破棄) */
export async function rejectAttendanceEdit(id: string) {
  const admin = await requireAdmin();
  const rec = await prisma.attendance.findUnique({ where: { id } });
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
  await logAudit(
    admin,
    "勤怠変更を却下",
    rec?.workDate.toLocaleDateString("ja-JP"),
  );
  revalidateAll();
}

const createSchema = z.object({
  userId: z.string().min(1, "対象者を選択してください"),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください"),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  note: z.string().optional(),
  breakMin: z.coerce.number().int().min(0).optional(),
});

/** 管理者: 勤怠記録を新規追加 */
export async function createAttendance(
  _prev: AttendanceFormState,
  formData: FormData,
): Promise<AttendanceFormState> {
  const admin = await requireAdmin();
  const rawBreak = formData.get("breakMin");
  const parsed = createSchema.safeParse({
    userId: formData.get("userId"),
    workDate: formData.get("workDate"),
    clockIn: formData.get("clockIn") || undefined,
    clockOut: formData.get("clockOut") || undefined,
    note: formData.get("note") || undefined,
    breakMin: rawBreak !== null && rawBreak !== "" ? rawBreak : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const d = parsed.data;
  const workDate = new Date(
    Number(d.workDate.slice(0, 4)),
    Number(d.workDate.slice(5, 7)) - 1,
    Number(d.workDate.slice(8, 10)),
  );

  const existing = await prisma.attendance.findUnique({
    where: { userId_workDate: { userId: d.userId, workDate } },
  });
  if (existing) {
    return { error: "その日の勤怠は既に存在します。編集してください" };
  }

  const clockIn = timeOnDate(workDate, d.clockIn);
  const clockOut = timeOnDate(workDate, d.clockOut);
  const breakMin =
    d.breakMin !== undefined ? d.breakMin : breakForTimes(clockIn, clockOut);

  await prisma.attendance.create({
    data: {
      userId: d.userId,
      workDate,
      clockIn,
      clockOut,
      breakMin,
      note: d.note ?? null,
    },
  });
  await logAudit(admin, "勤怠追加", d.workDate);
  revalidateAll();
  return { ok: true };
}

/** 管理者: 勤怠記録を削除 */
export async function deleteAttendance(id: string) {
  const admin = await requireAdmin();
  const rec = await prisma.attendance.findUnique({ where: { id } });
  await prisma.attendance.delete({ where: { id } });
  await logAudit(
    admin,
    "勤怠削除",
    rec?.workDate.toLocaleDateString("ja-JP"),
  );
  revalidateAll();
}
