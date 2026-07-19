export type RankKey = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "RAINBOW";

export type Rank = {
  key: RankKey;
  label: string; // 日本語表示
  en: string;
  maxInclusive: number | null; // この額以下(null は上限なし)
};

/** 確定済報酬実績(円)に応じたランク。しきい値は「以下」。 */
export const RANKS: Rank[] = [
  { key: "BRONZE", label: "ブロンズ", en: "BRONZE", maxInclusive: 10000 },
  { key: "SILVER", label: "シルバー", en: "SILVER", maxInclusive: 50000 },
  { key: "GOLD", label: "ゴールド", en: "GOLD", maxInclusive: 100000 },
  { key: "DIAMOND", label: "ダイヤモンド", en: "DIAMOND", maxInclusive: 500000 },
  { key: "RAINBOW", label: "レインボー", en: "RAINBOW", maxInclusive: null },
];

/** ランクごとの食事補助 月限度額(円) */
export const MEAL_LIMIT: Record<RankKey, number> = {
  BRONZE: 10000,
  SILVER: 15000,
  GOLD: 20000,
  DIAMOND: 50000,
  RAINBOW: 100000,
};

export function rankFor(amount: number): Rank {
  for (const r of RANKS) {
    if (r.maxInclusive === null || amount <= r.maxInclusive) return r;
  }
  return RANKS[RANKS.length - 1];
}
