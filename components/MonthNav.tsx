"use client";

import { useRouter } from "next/navigation";

export function MonthNav({
  year,
  month,
  basePath,
}: {
  year: number;
  month: number;
  basePath: string;
}) {
  const router = useRouter();

  const go = (y: number, m: number) => {
    router.push(`${basePath}?year=${y}&month=${m}`);
  };

  const prev = () => {
    const d = new Date(year, month - 2, 1);
    go(d.getFullYear(), d.getMonth() + 1);
  };
  const next = () => {
    const d = new Date(year, month, 1);
    go(d.getFullYear(), d.getMonth() + 1);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={prev}
        className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
        aria-label="前月"
      >
        ‹
      </button>
      <span className="text-sm font-medium w-28 text-center">
        {year}年{month}月
      </span>
      <button
        onClick={next}
        className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
        aria-label="翌月"
      >
        ›
      </button>
    </div>
  );
}
