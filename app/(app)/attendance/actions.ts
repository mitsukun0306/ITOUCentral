"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** その日の0時(ローカル)を返す */
function dayStart(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function clockIn() {
  const user = await requireUser();
  const workDate = dayStart();
  await prisma.attendance.upsert({
    where: { userId_workDate: { userId: user.id, workDate } },
    update: { clockIn: new Date() },
    create: { userId: user.id, workDate, clockIn: new Date() },
  });
  revalidatePath("/attendance");
}

export async function clockOut() {
  const user = await requireUser();
  const workDate = dayStart();
  await prisma.attendance.upsert({
    where: { userId_workDate: { userId: user.id, workDate } },
    update: { clockOut: new Date() },
    create: { userId: user.id, workDate, clockOut: new Date() },
  });
  revalidatePath("/attendance");
}

const editSchema = z.object({
  id: z.string(),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  breakMin: z.coerce.number().int().min(0).default(0),
  note: z.string().optional(),
});

export type AttendanceFormState = { error?: string; ok?: boolean };

/** 勤怠記録の手動編集(本人 or 管理者) */
export async function editAttendance(
  _prev: AttendanceFormState,
  formData: FormData,
): Promise<AttendanceFormState> {
  const user = await requireUser();
  const parsed = editSchema.safeParse({
    id: formData.get("id"),
    clockIn: formData.get("clockIn") || undefined,
    clockOut: formData.get("clockOut") || undefined,
    breakMin: formData.get("breakMin") || 0,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "入力エラー" };

  const rec = await prisma.attendance.findUnique({
    where: { id: parsed.data.id },
  });
  if (!rec) return { error: "記録が見つかりません" };
  if (user.role !== "ADMIN" && rec.userId !== user.id) {
    return { error: "権限がありません" };
  }

  const base = rec.workDate;
  const toDateTime = (hhmm?: string): Date | null => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
  };

  await prisma.attendance.update({
    where: { id: parsed.data.id },
    data: {
      clockIn: toDateTime(parsed.data.clockIn),
      clockOut: toDateTime(parsed.data.clockOut),
      breakMin: parsed.data.breakMin,
      note: parsed.data.note ?? null,
    },
  });
  revalidatePath("/attendance");
  return { ok: true };
}
