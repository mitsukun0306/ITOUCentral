import { requireUser } from "@/lib/auth";
import { getNotifications } from "@/lib/notifications";
import { NotificationViewer } from "./NotificationViewer";

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getNotifications(user);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">通知</h1>
        <p className="text-sm text-gray-500 mt-1">
          {user.role === "ADMIN"
            ? "完了申請や期限が迫っているタスクを1件ずつ確認できます"
            : "未着手・期限が迫っているタスクを1件ずつ確認できます"}
        </p>
      </div>
      <NotificationViewer notifications={notifications} />
    </div>
  );
}
