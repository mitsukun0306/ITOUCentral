import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSetting } from "@/lib/payroll";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");

  const setting = await getSetting();

  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="text-2xl font-bold">設定</h1>
      <SettingsForm
        companyName={setting.companyName}
        defaultPayrollMethod={setting.defaultPayrollMethod}
      />
    </div>
  );
}
