"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("権限がありません");
  return user;
}

const createSchema = z.object({
  name: z.string().min(1, "氏名は必須です"),
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(6, "パスワードは6文字以上にしてください"),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type MemberFormState = { error?: string; ok?: boolean };

export async function createMember(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const exists = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (exists) return { error: "そのメールアドレスは既に登録されています" };

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
    },
  });
  await logAudit(
    admin,
    "メンバー追加",
    `${parsed.data.name}(${parsed.data.role === "ADMIN" ? "管理者" : "メンバー"})`,
  );
  revalidatePath("/members");
  return { ok: true };
}

export async function toggleActive(userId: string) {
  const admin = await requireAdmin();
  if (admin.id === userId) throw new Error("自分自身は無効化できません");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("ユーザーが見つかりません");
  await prisma.user.update({
    where: { id: userId },
    data: { active: !user.active },
  });
  await logAudit(
    admin,
    user.active ? "メンバーを無効化" : "メンバーを有効化",
    user.name,
  );
  revalidatePath("/members");
}

const resetSchema = z.object({
  id: z.string(),
  password: z.string().min(6, "パスワードは6文字以上にしてください"),
});

export async function resetPassword(
  _prev: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const admin = await requireAdmin();
  const parsed = resetSchema.safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }
  const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  await prisma.user.update({
    where: { id: parsed.data.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  await logAudit(admin, "パスワード再設定", target?.name);
  revalidatePath("/members");
  return { ok: true };
}
