"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { yen } from "@/lib/format";

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
  const admin = await requireAdmin();
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
  await logAudit(admin, "リトリートイベント追加", d.title);
  revalidateAll();
  return { ok: true };
}

export async function deleteRetreatEvent(id: string) {
  const admin = await requireAdmin();
  const ev = await prisma.retreatEvent.findUnique({ where: { id } });
  await prisma.retreatEvent.delete({ where: { id } });
  await logAudit(admin, "リトリートイベント削除", ev?.title);
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
  await logAudit(user, "経費申請", `${d.title} ${yen(d.amount)}`);
  revalidateAll();
  return { ok: true };
}

async function decideExpense(id: string, status: "APPROVED" | "REJECTED") {
  const admin = await requireAdmin();
  const rec = await prisma.expenseRequest.update({
    where: { id },
    data: { status, decidedAt: new Date() },
    include: { user: { select: { name: true } } },
  });
  await logAudit(
    admin,
    status === "APPROVED" ? "経費承認" : "経費却下",
    `${rec.user.name} / ${rec.title} ${yen(rec.amount)}`,
  );
  revalidateAll();
}

export async function approveExpense(id: string) {
  await decideExpense(id, "APPROVED");
}

export async function rejectExpense(id: string) {
  await decideExpense(id, "REJECTED");
}

/** 申請の取消/削除。本人は未承認のみ、管理者は任意に削除可。 */
export async function deleteExpense(id: string) {
  const user = await requireUser();
  const rec = await prisma.expenseRequest.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  if (!rec) throw new Error("申請が見つかりません");
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin) {
    if (rec.userId !== user.id) throw new Error("権限がありません");
    if (rec.status !== "PENDING") {
      throw new Error("承認/却下済みの申請は取り消せません");
    }
  }
  await prisma.expenseRequest.delete({ where: { id } });
  await logAudit(
    user,
    isAdmin ? "経費申請の削除(管理者)" : "経費申請の取消",
    `${rec.user.name} / ${rec.title}`,
  );
  revalidateAll();
}

// ---------- 食事補助 ----------

const mealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください"),
  amount: z.coerce.number().int().min(1, "金額を入力してください"),
  item: z.string().min(1, "食べたものを入力してください"),
  place: z.string().min(1, "場所を入力してください"),
});

export type MealFormState = { error?: string; ok?: boolean };

/** 食事補助の記録を申請(1日1件相当。日々追加していく) */
export async function submitMeal(
  _prev: MealFormState,
  formData: FormData,
): Promise<MealFormState> {
  const user = await requireUser();
  const parsed = mealSchema.safeParse({
    date: formData.get("date"),
    amount: formData.get("amount"),
    item: formData.get("item"),
    place: formData.get("place"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const d = parsed.data;
  await prisma.mealRecord.create({
    data: {
      userId: user.id,
      date: toDate(d.date),
      amount: d.amount,
      item: d.item,
      place: d.place,
    },
  });
  await logAudit(user, "食事補助の申請", `${d.item} ${yen(d.amount)}`);
  revalidatePath("/benefits");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  return { ok: true };
}

/** 食事記録の削除(本人 or 管理者) */
export async function deleteMeal(id: string) {
  const user = await requireUser();
  const rec = await prisma.mealRecord.findUnique({ where: { id } });
  if (!rec) throw new Error("記録が見つかりません");
  if (user.role !== "ADMIN" && rec.userId !== user.id) {
    throw new Error("権限がありません");
  }
  await prisma.mealRecord.delete({ where: { id } });
  await logAudit(user, "食事補助の削除", rec.item);
  revalidatePath("/benefits");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
}
