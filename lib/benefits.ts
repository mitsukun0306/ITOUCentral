// クライアントコンポーネントからも使うため、DB には依存させない(取得は lib/payroll.ts の getBenefitToggles)。

/** 福利厚生の項目(管理者が設定画面で個別にオンオフできる) */
export type BenefitKey = "retreat" | "expense" | "meal";

export const BENEFIT_ITEMS: {
  key: BenefitKey;
  label: string;
  description: string;
}[] = [
  {
    key: "retreat",
    label: "リトリートイベント",
    description: "リトリートイベントの予定を表示します。",
  },
  {
    key: "expense",
    label: "経費申請",
    description: "メンバーが経費を申請できます。",
  },
  {
    key: "meal",
    label: "食事補助",
    description: "領収書を添付して食事補助を申請できます。",
  },
];

export type BenefitToggles = Record<BenefitKey, boolean>;

/** オフのときに表示する「ごめんなさい」メッセージ */
export function benefitUnavailableMessage(label: string): string {
  return `ごめんなさい。${label}は現在ご利用いただけません。再開までしばらくお待ちください。`;
}
