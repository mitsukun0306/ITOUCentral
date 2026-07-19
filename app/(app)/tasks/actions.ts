"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { TaskStatus } from "@/lib/generated/prisma";

const upsertSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "タイトルは必須です"),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  fixedReward: z.coerce.number().int().min(0).default(0),
  unitPrice: z.coerce.number().int().min(0).default(0),
  quantity: z.coerce.number().int().min(0).default(0),
  dueDate: z.string().optional(),
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
  await requireAdmin();

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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力エラー" };
  }

  const d = parsed.data;
  const assigneeId = d.assigneeId && d.assigneeId !== "" ? d.assigneeId : null;
  const dueDate = d.dueDate ? new Date(d.dueDate) : null;

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
    dueDate,
    completedAt,
  };

  if (d.id) {
    await prisma.task.update({ where: { id: d.id }, data });
  } else {
    await prisma.task.create({ data });
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** メンバー/管理者共通: 自分のタスクのステータス変更 */
export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const user = await requireUser();
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("タスクが見つかりません");
  if (user.role !== "ADMIN" && task.assigneeId !== user.id) {
    throw new Error("権限がありません");
  }

  const completedAt =
    status === "DONE" ? (task.completedAt ?? new Date()) : null;

  await prisma.task.update({
    where: { id: taskId },
    data: { status, completedAt },
  });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function deleteTask(taskId: string) {
  await requireAdmin();
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
