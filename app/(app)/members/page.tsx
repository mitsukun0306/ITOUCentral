import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MembersManager } from "./MembersManager";

export default async function MembersPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  const members = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { tasks: true } },
    },
  });

  return (
    <MembersManager
      currentUserId={user.id}
      members={members.map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        active: m.active,
        taskCount: m._count.tasks,
      }))}
    />
  );
}
