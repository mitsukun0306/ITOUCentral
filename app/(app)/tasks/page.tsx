import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TaskBoard } from "./TaskBoard";

export default async function TasksPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const tasks = await prisma.task.findMany({
    where: isAdmin ? {} : { assigneeId: user.id },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: { assignee: { select: { id: true, name: true } } },
  });

  const members = isAdmin
    ? await prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <TaskBoard
      isAdmin={isAdmin}
      currentUserId={user.id}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        assigneeId: t.assigneeId,
        assigneeName: t.assignee?.name ?? null,
        fixedReward: t.fixedReward,
        unitPrice: t.unitPrice,
        quantity: t.quantity,
        payoutYear: t.payoutYear,
        payoutMonth: t.payoutMonth,
        penalty24: t.penalty24,
        penalty72: t.penalty72,
        penaltyOver: t.penaltyOver,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      }))}
      members={members}
    />
  );
}
