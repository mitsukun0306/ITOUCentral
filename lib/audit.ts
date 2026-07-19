import "server-only";
import { prisma } from "@/lib/db";

type Actor = { id: string; name: string } | null;

/**
 * 操作ログを記録する。実行者は呼び出し側から渡す(actions は requireUser 済み)。
 * ログ記録の失敗が本処理を止めないよう、エラーは握りつぶす。
 */
export async function logAudit(
  actor: Actor,
  action: string,
  detail?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor?.name ?? "不明",
        action,
        detail: detail ?? null,
      },
    });
  } catch (e) {
    console.error("logAudit failed", e);
  }
}
