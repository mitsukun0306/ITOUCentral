import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AttendancePanel } from "./AttendancePanel";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const params = await searchParams;

  const members = isAdmin
    ? await prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  // 表示対象ユーザー(管理者は選択可、既定は自分)
  const targetId =
    isAdmin && params.member ? params.member : user.id;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const records = await prisma.attendance.findMany({
    where: { userId: targetId, workDate: { gte: start, lt: end } },
    orderBy: { workDate: "desc" },
  });

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const today = records.find(
    (r) => r.workDate.getTime() === todayStart.getTime(),
  );

  return (
    <AttendancePanel
      isAdmin={isAdmin}
      isSelf={targetId === user.id}
      members={members}
      selectedMember={targetId}
      today={
        today
          ? {
              id: today.id,
              clockIn: today.clockIn?.toISOString() ?? null,
              clockOut: today.clockOut?.toISOString() ?? null,
            }
          : null
      }
      records={records.map((r) => ({
        id: r.id,
        workDate: r.workDate.toISOString(),
        clockIn: r.clockIn?.toISOString() ?? null,
        clockOut: r.clockOut?.toISOString() ?? null,
        breakMin: r.breakMin,
        note: r.note,
      }))}
    />
  );
}
