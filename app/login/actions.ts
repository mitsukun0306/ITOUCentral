"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

const schema = z.object({
  email: z.string().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export type LoginState = { error?: string; ok?: boolean };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: "メールアドレスまたはパスワードが違います" };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return { error: "メールアドレスまたはパスワードが違います" };
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });

  // リダイレクトはクライアントで演出(名言アニメーション)後に行う
  return { ok: true };
}
