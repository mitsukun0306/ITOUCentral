import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/generated/prisma";

const COOKIE_NAME = "itou_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7日

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET が設定されていません");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** ログイン成功時にセッションCookieを発行 */
export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Cookieを検証して現在のユーザーを返す(未ログインなら null) */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  // 1) トークン自体の検証。署名不正・期限切れは「未認証」として null。
  let payload;
  try {
    ({ payload } = await jwtVerify(token, getSecret()));
  } catch {
    return null;
  }
  const id = payload.sub;
  if (!id) return null;

  // 2) DBで在籍確認(退職・停止ユーザーを弾く)。
  //    DBが一時的に応答しない場合でもログアウトさせず、トークンの情報で継続する
  //    (一過性のDB障害でセッションが飛ぶ／エラー画面になるのを防ぐ)。
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.active) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch (e) {
    console.error("getSessionUser: DB確認に失敗。トークン情報で継続します", e);
    return {
      id,
      name: typeof payload.name === "string" ? payload.name : "",
      email: typeof payload.email === "string" ? payload.email : "",
      role: payload.role === "ADMIN" ? "ADMIN" : "MEMBER",
    };
  }
}

/** 認証必須ページ/アクション用。未ログインなら /login へリダイレクト(例外は投げない)。 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return user?.role === "ADMIN";
}
