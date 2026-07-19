import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            ITOU<span className="text-brand">Central</span>
          </h1>
          <p className="text-sm text-gray-500 mt-2">いとう開発部 社内ポータル</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <LoginForm />
        </div>
        <p className="text-xs text-gray-400 text-center mt-6">
          社内関係者専用システムです
        </p>
      </div>
    </div>
  );
}
