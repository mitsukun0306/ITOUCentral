-- タスクごとの報酬方式(固定報酬 / 手付金 + 単価 × 成果量)
DO $$ BEGIN
    CREATE TYPE "TaskRewardType" AS ENUM ('FIXED', 'DEPOSIT_UNIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "rewardType" "TaskRewardType" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "deposit" INTEGER NOT NULL DEFAULT 0;

-- 既存タスクの移行:
-- 単価が入っていて固定報酬が 0 のタスク、または既定方式が「単価 × 成果量」だった場合の
-- 単価入りタスクは「手付金 + 単価 × 成果量」(手付金 0)にする。従来と同じ金額になる。
UPDATE "Task" SET "rewardType" = 'DEPOSIT_UNIT'
WHERE "unitPrice" > 0
  AND (
    "fixedReward" = 0
    OR EXISTS (SELECT 1 FROM "Setting" WHERE "defaultPayrollMethod" = 'UNIT_QUANTITY')
  );

-- 給与の方式は「タスク別方式の合算」と「月次手入力」の2つに整理。
-- 旧「単価 × 成果量」は既定設定と未確定の給与だけ置き換える(確定済みはそのまま)。
UPDATE "Setting" SET "defaultPayrollMethod" = 'TASK_FIXED' WHERE "defaultPayrollMethod" = 'UNIT_QUANTITY';
UPDATE "Payroll" SET "method" = 'TASK_FIXED' WHERE "method" = 'UNIT_QUANTITY' AND "status" = 'DRAFT';
