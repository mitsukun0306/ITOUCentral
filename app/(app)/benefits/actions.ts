"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("権限がありません");
  return user;
}

function revalidateAll() {
  revalidatePath("/benefits");
  revalidatePath("/notifications");
}

// ---------- リトリートイベント(管理者) ----------

const eventSchema = z.object({
  title: z.string().min(1, "タイトルは必須です"),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "開始日を入力してください"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type EventFormState = { error?: string; ok?: boolean };

function toDate(ymd: string): Date {
  return new Date(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10)),
  );
}

export async function createRetreatEvent(
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  await requireAdmin();
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const d = parsed.data;
  await prisma.retreatEvent.create({
    data: {
      title: d.title,
      description: d.description ?? null,
      location: d.location ?? null,
      startDate: toDate(d.startDate),
      endDate: d.endDate ? toDate(d.endDate) : null,
    },
  });
  revalidateAll();
  return { ok: true };
}

export async function deleteRetreatEvent(id: string) {
  await requireAdmin();
  await prisma.retreatEvent.delete({ where: { id } });
  revalidateAll();
}

// ---------- 経費申請 ----------

const expenseSchema = z.object({
  title: z.string().min(1, "件名は必須です"),
  amount: z.coerce.number().int().min(1, "金額を入力してください"),
  category: z.string().optional(),
  incurredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  note: z.string().optional(),
});

export type ExpenseFormState = { error?: string; ok?: boolean };

/** メンバー/管理者: 経費を申請(PENDING で作成) */
export async function submitExpense(
  _prev: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const user = await requireUser();
  const parsed = expenseSchema.safeParse({
    title: formData.get("title"),
    amount: formData.get("amount"),
    category: formData.get("category") || undefined,
    incurredOn: formData.get("incurredOn") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const d = parsed.data;
  await prisma.expenseRequest.create({
    data: {
      userId: user.id,
      title: d.title,
      amount: d.amount,
      category: d.category ?? null,
      incurredOn: d.incurredOn ? toDate(d.incurredOn) : null,
      note: d.note ?? null,
    },
  });
  revalidateAll();
  return { ok: true };
}

async function decideExpense(id: string, status: "APPROVED" | "REJECTED") {
  await requireAdmin();
  await prisma.expenseRequest.update({
    where: { id },
    data: { status, decidedAt: new Date() },
  });
  revalidateAll();
}

export async function approveExpense(id: string) {
  await decideExpense(id, "APPROVED");
}

export async function rejectExpense(id: string) {
  await decideExpense(id, "REJECTED");
}

/** 申請の取消(本人の未承認のみ)/ 管理者は任意に削除可 */
export async function deleteExpense(id: string) {
  const user = await requireUser();
  const rec = await prisma.expenseRequest.findUnique({ where: { id } });
  if (!rec) throw new Error("申請が見つかりません");
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin) {
    if (rec.userId !== user.id) throw new Error("権限がありません");
    if (rec.status !== "PENDING") {
      throw new Error("承認/却下済みの申請は取り消せません");
    }
  }
  await prisma.expenseRequest.delete({ where: { id } });
  revalidateAll();
}
