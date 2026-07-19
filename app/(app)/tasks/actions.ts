"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import type { TaskStatus } from "@/lib/generated/prisma";

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "未着手",
  IN_PROGRESS: "進行中",
  REVIEW: "完了申請中",
  DONE: "完了",
};

const upsertSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "タイトルは必須です"),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  fixedReward: z.coerce.number().int().min(0).default(0),
  unitPrice: z.coerce.number().int().min(0).default(0),
  quantity: z.coerce.number().int().min(0).default(0),
  dueDate: z.string().optional(),
  // 支給月 "YYYY-MM"。空なら完了月に計上。
  payoutMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

export type TaskFormState = { error?: string; ok?: boolean };

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("権限がありません");
  return user;
}

export async function upsertTask(
  _prev: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const admin = await requireAdmin();

  const parsed = upsertSchema.safeParse({
    id: formData.get("id") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    assigneeId: formData.get("assigneeId") || undefined,
    status: formData.get("status"),
    fixedReward: formData.get("fixedReward") || 0,
    unitPrice: formData.get("unitPrice") || 0,
    quantity: formData.get("quantity") || 0,
    dueDate: formData.get("dueDate") || undefined,
    payoutMonth: formData.get("payoutMonth") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const d = parsed.data;
  const assigneeId = d.assigneeId && d.assigneeId !== "" ? d.assigneeId : null;
  const dueDate = d.dueDate ? new Date(d.dueDate) : null;
  // 支給月 "YYYY-MM" を分解(未指定なら null)
  let payoutYear: number | null = null;
  let payoutMonth: number | null = null;
  if (d.payoutMonth) {
    const [py, pm] = d.payoutMonth.split("-").map(Number);
    payoutYear = py;
    payoutMonth = pm;
  }

  // 完了状態への変更で completedAt を管理
  const existing = d.id
    ? await prisma.task.findUnique({ where: { id: d.id } })
    : null;

  let completedAt = existing?.completedAt ?? null;
  if (d.status === "DONE" && !completedAt) completedAt = new Date();
  if (d.status !== "DONE") completedAt = null;

  const data = {
    title: d.title,
    description: d.description ?? null,
    assigneeId,
    status: d.status as TaskStatus,
    fixedReward: d.fixedReward,
    unitPrice: d.unitPrice,
    quantity: d.quantity,
    payoutYear,
    payoutMonth,
    dueDate,
    completedAt,
  };

  if (d.id) {
    await prisma.task.update({ where: { id: d.id }, data });
    await logAudit(admin, "タスク更新", d.title);
  } else {
    await prisma.task.create({ data });
    await logAudit(admin, "タスク作成", d.title);
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { ok: true };
}

/** メンバー/管理者共通: 自分のタスクのステータス変更 */
export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const user = await requireUser();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("タスクが見つかりません");

  const isAdmin = user.role === "ADMIN";
  if (!isAdmin) {
    if (task.assigneeId !== user.id) throw new Error("権限がありません");
    // メンバーは「完了(DONE)」を直接設定できない。完了は申請(REVIEW)まで。
    if (status === "DONE") {
      throw new Error("完了は管理者の承認が必要です。完了申請を行ってください");
    }
  }

  const completedAt =
    status === "DONE" ? (task.completedAt ?? new Date()) : null;

  await prisma.task.update({
    where: { id: taskId },
    data: { status, completedAt },
  });
  await logAudit(
    user,
    status === "REVIEW" ? "タスク完了申請" : "タスク状態変更",
    `${task.title} → ${STATUS_LABEL[status]}`,
  );
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

export async function deleteTask(taskId: string) {
  const admin = await requireAdmin();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  await prisma.task.delete({ where: { id: taskId } });
  await logAudit(admin, "タスク削除", task?.title);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}
