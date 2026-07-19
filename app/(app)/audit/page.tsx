import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function AuditPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">監査ログ</h1>
        <p className="text-sm text-gray-500 mt-1">
          全ユーザーの操作履歴(最新300件)
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="px-4 py-2 font-medium whitespace-nowrap">日時</th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">
                  実行者
                </th>
                <th className="px-4 py-2 font-medium whitespace-nowrap">操作</th>
                <th className="px-4 py-2 font-medium">詳細</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-gray-400"
                  >
                    まだログはありません
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                      {formatDateTime(l.createdAt)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {l.actorName}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap font-medium">
                      {l.action}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{l.detail ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
