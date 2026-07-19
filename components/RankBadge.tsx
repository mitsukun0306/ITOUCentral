import { rankFor, RANKS, MEAL_LIMIT, type RankKey } from "@/lib/rank";

const STYLE: Record<
  RankKey,
  { grad: string; text: string; ring: string; icon: string }
> = {
  BRONZE: {
    grad: "linear-gradient(135deg,#a97142,#7a4a24)",
    text: "#fff",
    ring: "rgba(169,113,66,.45)",
    icon: "🥉",
  },
  SILVER: {
    grad: "linear-gradient(135deg,#c9d2dc,#8b95a1)",
    text: "#1a1d21",
    ring: "rgba(139,149,161,.5)",
    icon: "🥈",
  },
  GOLD: {
    grad: "linear-gradient(135deg,#f7d774,#d9a419)",
    text: "#3a2c00",
    ring: "rgba(217,164,25,.5)",
    icon: "🥇",
  },
  DIAMOND: {
    grad: "linear-gradient(135deg,#aef2ff,#38bdf8,#6366f1)",
    text: "#06283d",
    ring: "rgba(56,189,248,.5)",
    icon: "💎",
  },
  RAINBOW: {
    grad:
      "linear-gradient(120deg,#ff5f6d,#ffc371,#47e5bc,#4d9fff,#a06bff,#ff5f6d)",
    text: "#fff",
    ring: "rgba(160,107,255,.5)",
    icon: "🌈",
  },
};

export function RankBadge({
  amount,
  rankKey,
  size = "md",
}: {
  amount?: number;
  rankKey?: RankKey;
  size?: "sm" | "md";
}) {
  const rank = rankKey
    ? (RANKS.find((r) => r.key === rankKey) ?? rankFor(0))
    : rankFor(amount ?? 0);
  const s = STYLE[rank.key];
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";

  return (
    <span
      className={`rank-badge ${
        rank.key === "RAINBOW" ? "rank-rainbow" : ""
      } inline-flex items-center gap-1.5 rounded-full font-bold ${pad}`}
      style={{
        background: s.grad,
        color: s.text,
        boxShadow: `0 2px 10px ${s.ring}`,
        backgroundSize: rank.key === "RAINBOW" ? "300% 100%" : undefined,
      }}
      title={`食事補助 月限度額 ${MEAL_LIMIT[rank.key].toLocaleString("ja-JP")}円`}
    >
      <span>{s.icon}</span>
      {rank.label}
    </span>
  );
}
