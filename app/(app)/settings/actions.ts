"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  companyName: z.string().min(1, "組織名は必須です"),
  defaultPayrollMethod: z.enum([
    "TASK_FIXED",
    "UNIT_QUANTITY",
    "MONTHLY_MANUAL",
  ]),
  benefitRetreatEnabled: z.boolean(),
  benefitExpenseEnabled: z.boolean(),
  benefitMealEnabled: z.boolean(),
});

export type SettingState = { error?: string; ok?: boolean };

export async function updateSetting(
  _prev: SettingState,
  formData: FormData,
): Promise<SettingState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "権限がありません" };

  const parsed = schema.safeParse({
    companyName: formData.get("companyName"),
    defaultPayrollMethod: formData.get("defaultPayrollMethod"),
    // チェックボックスは未チェック時に値が送られないため、"on" の有無で判定
    benefitRetreatEnabled: formData.get("benefitRetreatEnabled") === "on",
    benefitExpenseEnabled: formData.get("benefitExpenseEnabled") === "on",
    benefitMealEnabled: formData.get("benefitMealEnabled") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  await prisma.setting.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });
  const d = parsed.data;
  const off = [
    !d.benefitRetreatEnabled && "リトリートイベント",
    !d.benefitExpenseEnabled && "経費申請",
    !d.benefitMealEnabled && "食事補助",
  ].filter(Boolean);
  await logAudit(
    user,
    "設定を変更",
    `${d.companyName} / 福利厚生オフ: ${off.length ? off.join("・") : "なし"}`,
  );
  revalidatePath("/settings");
  revalidatePath("/benefits");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  return { ok: true };
}
