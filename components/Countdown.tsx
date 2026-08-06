"use client";

import { useEffect, useState } from "react";

/**
 * 期限までのカウントダウン表示。
 * - 期限の10日前から表示(それより前は非表示)
 * - 残り24時間以内は「あと◯時間」(1時間単位)
 * - 期限(JST 0:00)を過ぎたら「期限超過」
 */
export function Countdown({
  dueIso,
  done = false,
}: {
  dueIso: string;
  done?: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // クライアント確定前(SSR/初期)は描画しない(ハイドレーション不一致回避)
  if (now === null || done) return null;

  const due = new Date(dueIso).getTime();
  const diff = due - now;
  const base =
    "text-[11px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap";

  if (diff <= 0) {
    return <span className={`${base} bg-red-100 text-red-700`}>期限超過</span>;
  }

  const hours = diff / 3_600_000;
  if (hours <= 24) {
    return (
      <span className={`${base} bg-red-50 text-red-600`}>
        あと{Math.ceil(hours)}時間
      </span>
    );
  }

  const days = diff / 86_400_000;
  if (days <= 10) {
    return (
      <span className={`${base} bg-amber-50 text-amber-700`}>
        あと{Math.ceil(days)}日
      </span>
    );
  }

  return null;
}
