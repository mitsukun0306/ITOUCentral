"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { AppNotification, NotificationKind } from "@/lib/notifications";

const KIND_STYLE: Record<
  NotificationKind,
  { badge: string; label: string; icon: string; ring: string }
> = {
  COMPLETION_REQUEST: {
    badge: "bg-blue-100 text-blue-700",
    label: "完了申請",
    icon: "📝",
    ring: "border-blue-200",
  },
  ATTENDANCE_EDIT_REQUEST: {
    badge: "bg-indigo-100 text-indigo-700",
    label: "勤怠変更申請",
    icon: "🕒",
    ring: "border-indigo-200",
  },
  DEADLINE_OVERDUE: {
    badge: "bg-red-100 text-red-700",
    label: "期限超過",
    icon: "⚠",
    ring: "border-red-200",
  },
  DEADLINE_SOON: {
    badge: "bg-amber-100 text-amber-700",
    label: "期限接近",
    icon: "⏰",
    ring: "border-amber-200",
  },
  TODO: {
    badge: "bg-gray-100 text-gray-600",
    label: "未着手",
    icon: "•",
    ring: "border-gray-200",
  },
};

export function NotificationViewer({
  notifications,
}: {
  notifications: AppNotification[];
}) {
  const [index, setIndex] = useState(0);

  if (notifications.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <p className="text-4xl mb-3">🎉</p>
        <p className="text-gray-600 font-medium">通知はありません</p>
        <p className="text-sm text-gray-400 mt-1">
          未対応の項目はすべて片付いています。
        </p>
      </div>
    );
  }

  const total = notifications.length;
  const current = index % total;
  const n = notifications[current];
  const style = KIND_STYLE[n.kind];

  const next = () => setIndex((i) => (i + 1) % total);

  return (
    <div className="space-y-3">
      {/* 1件ずつ表示 */}
      <div className={`bg-white rounded-xl border p-6 ${style.ring}`}>
        <div className="flex items-center justify-between">
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.badge}`}
          >
            {style.icon} {style.label}
          </span>
          <span className="text-xs text-gray-400">
            {current + 1} / {total} 件
          </span>
        </div>

        <h2 className="text-lg font-semibold mt-4">{n.title}</h2>
        <p className="text-gray-700 mt-1">{n.detail}</p>
        {n.dueDate && (
          <p className="text-sm text-gray-500 mt-2">
            期限: {formatDate(n.dueDate)}
          </p>
        )}

        <div className="flex items-center gap-3 mt-6">
          <Link
            href={n.href}
            className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:bg-brand-dark"
          >
            {n.linkLabel}
          </Link>
          {total > 1 && (
            <button
              onClick={next}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              次の通知へ →
            </button>
          )}
        </div>
      </div>

      {total > 1 && (
        <p className="text-center text-xs text-gray-400">
          ほかに {total - 1} 件の通知があります
        </p>
      )}
    </div>
  );
}
