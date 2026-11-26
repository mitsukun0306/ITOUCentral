"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computePayroll, mealAllowanceForMonth } from "@/lib/payroll";
import { logAudit } from "@/lib/audit";
import { yen } from "@/lib/format";
import type { PayrollMethod } from "@/lib/generated/prisma";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("権限がありません");
  return user;
}

const genSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  method: z.enum(["TASK_FIXED", "UNIT_QUANTITY", "MONTHLY_MANUAL"]),
});

/**
 * 指定年月・方式で全アクティブメンバーの給与を集計し DRAFT として保存。
 * 確定済み(CONFIRMED)のレコードは上書きしない。
 * MONTHLY_MANUAL では自動額は 0 のまま(手入力運用)。
 */
export async function generatePayroll(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = genSchema.safeParse({
    year: formData.get("year"),
    month: formData.get("month"),
    method: formData.get("method"),
  });
  if (!parsed.success) throw new Error("入力エラー");
  const { year, month, method } = parsed.data;

  const members = await prisma.user.findMany({ where: { active: true } });

  for (const m of members) {
    const existing = await prisma.payroll.findUnique({
      where: { userId_year_month: { userId: m.id, year, month } },
    });
    if (existing?.status === "CONFIRMED") continue;

    const { amount } = await computePayroll(m.id, year, month, method);

    // 手入力方式で既存の入力額がある場合は保持
    const finalAmount =
      method === "MONTHLY_MANUAL" ? (existing?.amount ?? 0) : amount;

    await prisma.payroll.upsert({
      where: { userId_year_month: { userId: m.id, year, month } },
      update: { method: method as PayrollMethod, amount: finalAmount },
      create: {
        userId: m.id,
        year,
        month,
        method: method as PayrollMethod,
        amount: finalAmount,
        status: "DRAFT",
      },
    });
  }

  await logAudit(admin, "給与を計算・保存", `${year}年${month}月`);
  revalidatePath("/payroll");
  revalidatePath("/dashboard");
}

const manualSchema = z.object({
  id: z.string(),
  amount: z.coerce.number().int().min(0),
  note: z.string().optional(),
});

export type ManualState = { error?: string; ok?: boolean };

/** 給与額の手入力・メモ更新(DRAFTのみ) */
export async function setPayrollAmount(
  _prev: ManualState,
  formData: FormData,
): Promise<ManualState> {
  const admin = await requireAdmin();
  const parsed = manualSchema.safeParse({
    id: formData.get("id"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: "入力エラー" };

  const rec = await prisma.payroll.findUnique({
    where: { id: parsed.data.id },
  });
  if (!rec) return { error: "記録が見つかりません" };
  if (rec.status === "CONFIRMED")
    return { error: "確定済みのため編集できません" };

  await prisma.payroll.update({
    where: { id: parsed.data.id },
    data: { amount: parsed.data.amount, note: parsed.data.note ?? null },
  });
  await logAudit(
    admin,
    "給与額を編集",
    `${rec.year}年${rec.month}月 → ¥${parsed.data.amount.toLocaleString("ja-JP")}`,
  );
  revalidatePath("/payroll");
  return { ok: true };
}

export async function confirmPayroll(id: string) {
  const admin = await requireAdmin();
  const rec = await prisma.payroll.findUnique({ where: { id } });
  if (!rec) throw new Error("記録が見つかりません");

  // 確定時に、タスクベース方式は最新の金額+食事補助を凍結する。
  // 手入力方式は入力額をそのまま確定。
  let amount = rec.amount;
  if (rec.method !== "MONTHLY_MANUAL") {
    const { amount: base } = await computePayroll(
      rec.userId,
      rec.year,
      rec.month,
      rec.method,
    );
    const { allowance } = await mealAllowanceForMonth(
      rec.userId,
      rec.year,
      rec.month,
    );
    amount = base + allowance;
  }

  await prisma.payroll.update({
    where: { id },
    data: { status: "CONFIRMED", confirmedAt: new Date(), amount },
  });
  await logAudit(
    admin,
    "給与を確定",
    `${rec.year}年${rec.month}月 ¥${amount.toLocaleString("ja-JP")}`,
  );
  revalidatePath("/payroll");
  revalidatePath("/dashboard");
}

export async function unconfirmPayroll(id: string) {
  const admin = await requireAdmin();
  const rec = await prisma.payroll.findUnique({ where: { id } });
  await prisma.payroll.update({
    where: { id },
    data: { status: "DRAFT", confirmedAt: null },
  });
  await logAudit(
    admin,
    "給与の確定を解除",
    rec ? `${rec.year}年${rec.month}月` : undefined,
  );
  revalidatePath("/payroll");
}

// ───────────── 天引き ─────────────

const deductionSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, "メンバーを選択してください"),
  // <input type="month"> の値(YYYY-MM)
  target: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "対象給与月を選択してください"),
  label: z.string().trim().min(1, "項目名は必須です").max(50, "項目名は50文字以内にしてください"),
  amount: z.coerce
    .number({ message: "天引き額を入力してください" })
    .int("天引き額は整数(円)で入力してください")
    .min(1, "天引き額は1円以上にしてください")
    .max(100_000_000, "天引き額が大きすぎます"),
  note: z.string().trim().max(200, "備考は200文字以内にしてください").optional(),
});

export type DeductionState = { error?: string; ok?: boolean };

/** 対象月の給与が確定済みなら天引きの変更を拒否する */
async function lockedMessage(userId: string, year: number, month: number) {
  const p = await prisma.payroll.findUnique({
    where: { userId_year_month: { userId, year, month } },
    select: { status: true },
  });
  return p?.status === "CONFIRMED"
    ? `${year}年${month}月の給与は確定済みのため、天引きを変更できません(先に確定解除してください)`
    : null;
}

/** 天引きの追加・編集(id があれば編集) */
export async function saveDeduction(
  _prev: DeductionState,
  formData: FormData,
): Promise<DeductionState> {
  const admin = await requireAdmin();
  const parsed = deductionSchema.safeParse({
    id: formData.get("id") || undefined,
    userId: formData.get("userId"),
    target: formData.get("target"),
    label: formData.get("label"),
    amount: formData.get("amount"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const { id, userId, target, label, amount, note } = parsed.data;
  const [year, month] = target.split("-").map(Number);

  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  if (!member) return { error: "メンバーが見つかりません" };

  const locked = await lockedMessage(userId, year, month);
  if (locked) return { error: locked };

  if (id) {
    const before = await prisma.payrollDeduction.findUnique({ where: { id } });
    if (!before) return { error: "天引きが見つかりません" };
    // 移動元の月が確定済みの場合も変更不可
    const lockedBefore = await lockedMessage(
      before.userId,
      before.year,
      before.month,
    );
    if (lockedBefore) return { error: lockedBefore };
    await prisma.payrollDeduction.update({
      where: { id },
      data: { userId, year, month, label, amount, note: note ?? null },
    });
    await logAudit(
      admin,
      "天引きを編集",
      `${member.name} ${year}年${month}月 ${label} ${yen(amount)}`,
    );
  } else {
    await prisma.payrollDeduction.create({
      data: {
        userId,
        year,
        month,
        label,
        amount,
        note: note ?? null,
        createdById: admin.id,
      },
    });
    await logAudit(
      admin,
      "天引きを追加",
      `${member.name} ${year}年${month}月 ${label} ${yen(amount)}`,
    );
  }

  revalidatePath("/payroll");
  return { ok: true };
}

export async function deleteDeduction(id: string): Promise<DeductionState> {
  const admin = await requireAdmin();
  const rec = await prisma.payrollDeduction.findUnique({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  if (!rec) return { error: "天引きが見つかりません" };
  const locked = await lockedMessage(rec.userId, rec.year, rec.month);
  if (locked) return { error: locked };
  await prisma.payrollDeduction.delete({ where: { id } });
  await logAudit(
    admin,
    "天引きを削除",
    `${rec.user.name} ${rec.year}年${rec.month}月 ${rec.label} ${yen(rec.amount)}`,
  );
  revalidatePath("/payroll");
  return { ok: true };
}
