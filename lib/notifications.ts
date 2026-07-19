import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export type NotificationKind =
  | "COMPLETION_REQUEST" // タスク完了申請(管理者向け)
  | "ATTENDANCE_EDIT_REQUEST" // 勤怠変更申請(管理者向け)
  | "DEADLINE_OVERDUE" // 期限超過
  | "DEADLINE_SOON" // 期限接近
  | "TODO"; // 未着手

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  href: string;
  linkLabel: string;
  dueDate: string | null;
};

const SOON_DAYS = 3; // 「期限が迫っている」とみなす日数

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/**
 * 現在のユーザー向け通知を、優先度順に並べて返す。
 * - 管理者: 完了申請 → 勤怠変更申請 → 期限超過 → 期限接近
 * - メンバー: 期限超過 → 期限接近 → 未着手(自分の担当分)
 */
export async function getNotifications(
  user: SessionUser,
): Promise<AppNotification[]> {
  const today = startOfToday();
  const soon = new Date(today);
  soon.setDate(today.getDate() + SOON_DAYS + 1); // soon の上限(排他)

  const list: AppNotification[] = [];
  const seen = new Set<string>();
  const isAdmin = user.role === "ADMIN";

  // --- 管理者: タスク完了申請 ---
  if (isAdmin) {
    const reviews = await prisma.task.findMany({
      where: { status: "REVIEW" },
      include: { assignee: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
    });
    for (const t of reviews) {
      list.push({
        id: `review-${t.id}`,
        kind: "COMPLETION_REQUEST",
        title: "タスク完了申請",
        detail: `${t.title}(申請者: ${t.assignee?.name ?? "未割当"})`,
        href: "/tasks",
        linkLabel: "タスクを開く",
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      });
      seen.add(t.id);
    }

    // --- 管理者: 勤怠変更申請 ---
    const attReqs = await prisma.attendance.findMany({
      where: { editRequested: true },
      include: { user: { select: { name: true } } },
      orderBy: { reqAt: "asc" },
    });
    for (const a of attReqs) {
      list.push({
        id: `att-${a.id}`,
        kind: "ATTENDANCE_EDIT_REQUEST",
        title: "勤怠の変更申請",
        detail: `${a.user.name} / ${a.workDate.toLocaleDateString("ja-JP")}`,
        href: `/attendance?member=${a.userId}`,
        linkLabel: "勤怠を開く",
        dueDate: null,
      });
    }
  }

  // --- 期限(超過・接近)。管理者は全体、メンバーは自分の担当のみ。DONE は除外 ---
  const deadlineTasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { not: null, lt: soon },
      ...(isAdmin ? {} : { assigneeId: user.id }),
    },
    include: { assignee: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
  });

  const overdue: AppNotification[] = [];
  const dueSoon: AppNotification[] = [];
  for (const t of deadlineTasks) {
    if (!t.dueDate || seen.has(t.id)) continue;
    seen.add(t.id);
    const who = isAdmin ? `担当: ${t.assignee?.name ?? "未割当"}` : "";
    const isOverdue = t.dueDate < today;
    const n: AppNotification = {
      id: `deadline-${t.id}`,
      kind: isOverdue ? "DEADLINE_OVERDUE" : "DEADLINE_SOON",
      title: isOverdue ? "期限超過" : "期限が近づいています",
      detail: [t.title, who].filter(Boolean).join(" / "),
      href: "/tasks",
      linkLabel: "タスクを開く",
      dueDate: t.dueDate.toISOString(),
    };
    (isOverdue ? overdue : dueSoon).push(n);
  }
  list.push(...overdue, ...dueSoon);

  // --- メンバー: 未着手(自分の担当) ---
  if (!isAdmin) {
    const todos = await prisma.task.findMany({
      where: { assigneeId: user.id, status: "TODO" },
      orderBy: { createdAt: "asc" },
    });
    for (const t of todos) {
      if (seen.has(t.id)) continue; // 期限通知と重複させない
      seen.add(t.id);
      list.push({
        id: `todo-${t.id}`,
        kind: "TODO",
        title: "未着手のタスク",
        detail: t.title,
        href: "/tasks",
        linkLabel: "タスクを開く",
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      });
    }
  }

  return list;
}

/** バッジ表示用の件数(getNotifications と同じ基準) */
export async function countNotifications(user: SessionUser): Promise<number> {
  const notifications = await getNotifications(user);
  return notifications.length;
}
