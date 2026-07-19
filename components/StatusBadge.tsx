import type { TaskStatus } from "@/lib/generated/prisma";

const statusMap: Record<TaskStatus, { label: string; cls: string }> = {
  TODO: { label: "未着手", cls: "bg-gray-100 text-gray-600" },
  IN_PROGRESS: { label: "進行中", cls: "bg-amber-100 text-amber-700" },
  REVIEW: { label: "完了申請中", cls: "bg-blue-100 text-blue-700" },
  DONE: { label: "完了", cls: "bg-green-100 text-green-700" },
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "未着手",
  IN_PROGRESS: "進行中",
  REVIEW: "完了申請中",
  DONE: "完了",
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const s = statusMap[status];
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
