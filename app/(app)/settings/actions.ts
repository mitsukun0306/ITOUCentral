"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  companyName: z.string().min(1, "組織名は必須です"),
  defaultPayrollMethod: z.enum([
    "TASK_FIXED",
    "UNIT_QUANTITY",
    "MONTHLY_MANUAL",
  ]),
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  await prisma.setting.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/payroll");
  return { ok: true };
}
