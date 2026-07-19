import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { countNotifications } from "@/lib/notifications";
import { Sidebar } from "./Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notifCount = await countNotifications(user);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar user={user} notifCount={notifCount} />
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
