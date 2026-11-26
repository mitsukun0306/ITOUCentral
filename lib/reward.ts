// タスクごとの報酬方式の計算(DB に依存しない純粋関数。クライアントからも利用)
import { yen } from "@/lib/format";
import type { Task, TaskRewardType } from "@/lib/generated/prisma";

export const TASK_REWARD_LABEL: Record<TaskRewardType, string> = {
  FIXED: "固定報酬",
  DEPOSIT_UNIT: "手付金 + 単価 × 成果量",
};

/** 成果量スライダーの上限(数値入力ではこれ以上も入力可) */
export const QUANTITY_SLIDER_MAX = 100;

export type RewardTask = Pick<
  Task,
  "rewardType" | "fixedReward" | "deposit" | "unitPrice" | "quantity"
>;

/** 1タスクの報酬額(減額前の基準額)を、タスクに設定された報酬方式で算出 */
export function taskAmount(task: RewardTask): number {
  switch (task.rewardType) {
    case "FIXED":
      return task.fixedReward;
    case "DEPOSIT_UNIT":
      return task.deposit + task.unitPrice * task.quantity;
  }
}

/** 報酬の内訳表示(例: "手付金 ¥10,000 + ¥3,000 × 5") */
export function taskAmountDetail(task: RewardTask): string {
  if (task.rewardType === "FIXED") return `固定報酬 ${yen(task.fixedReward)}`;
  const unit = `${yen(task.unitPrice)} × ${task.quantity}`;
  return task.deposit > 0 ? `手付金 ${yen(task.deposit)} + ${unit}` : unit;
}
