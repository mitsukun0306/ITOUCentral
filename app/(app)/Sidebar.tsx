"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { logout } from "./logout/actions";

const nav = [
  { href: "/dashboard", label: "ダッシュボード", icon: "▦" },
  { href: "/notifications", label: "通知", icon: "🔔" },
  { href: "/tasks", label: "タスク", icon: "✓" },
  { href: "/attendance", label: "勤怠", icon: "◷" },
  { href: "/payroll", label: "給与", icon: "¥" },
];

const adminNav = [
  { href: "/members", label: "メンバー管理", icon: "👤" },
  { href: "/settings", label: "設定", icon: "⚙" },
];

export function Sidebar({
  user,
  notifCount = 0,
}: {
  user: SessionUser;
  notifCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = user.role === "ADMIN" ? [...nav, ...adminNav] : nav;

  const linkClass = (href: string) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      active
        ? "bg-brand text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;
  };

  return (
    <>
      {/* モバイル用ヘッダー */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3">
        <span className="font-bold">
          ITOU<span className="text-brand">Central</span>
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative text-gray-600 text-xl"
          aria-label="メニュー"
        >
          ☰
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold">
              {notifCount > 99 ? "99+" : notifCount}
            </span>
          )}
        </button>
      </div>

      <aside
        className={`${
          open ? "block" : "hidden"
        } md:block w-full md:w-60 bg-white border-r border-gray-200 md:min-h-screen flex-shrink-0`}
      >
        <div className="p-4 hidden md:block">
          <span className="text-lg font-bold">
            ITOU<span className="text-brand">Central</span>
          </span>
        </div>

        <nav className="px-3 py-2 space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={linkClass(item.href)}
            >
              <span className="w-5 text-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/notifications" && notifCount > 0 && (
                <span className="min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold">
                  {notifCount > 99 ? "99+" : notifCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-3 border-t border-gray-200 md:absolute md:bottom-0 md:w-60">
          <div className="px-2 py-2">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-gray-400">
              {user.role === "ADMIN" ? "管理者" : "メンバー"}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
            >
              ログアウト
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
