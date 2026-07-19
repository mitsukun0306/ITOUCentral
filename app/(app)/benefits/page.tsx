import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BenefitsPanel } from "./BenefitsPanel";

export default async function BenefitsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // イベントは今日以降を優先しつつ全件(過去も見えるように昇順)
  const events = await prisma.retreatEvent.findMany({
    orderBy: { startDate: "asc" },
  });

  const expenses = await prisma.expenseRequest.findMany({
    where: isAdmin ? {} : { userId: user.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { user: { select: { name: true } } },
  });

  return (
    <BenefitsPanel
      isAdmin={isAdmin}
      events={events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate ? e.endDate.toISOString() : null,
        upcoming: e.startDate >= todayStart,
      }))}
      expenses={expenses.map((x) => ({
        id: x.id,
        userName: x.user.name,
        title: x.title,
        amount: x.amount,
        category: x.category,
        incurredOn: x.incurredOn ? x.incurredOn.toISOString() : null,
        note: x.note,
        status: x.status,
        createdAt: x.createdAt.toISOString(),
      }))}
    />
  );
}
