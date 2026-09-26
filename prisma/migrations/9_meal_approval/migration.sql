-- 食事補助にも経費申請と同様の承認フローを追加。承認済みのみ報酬に計上する。
ALTER TABLE "MealRecord" ADD COLUMN "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "MealRecord" ADD COLUMN "decidedAt" TIMESTAMP(3);

-- 承認フロー導入前の既存申請は運用に影響が出ないよう承認済みとして扱う
UPDATE "MealRecord" SET "status" = 'APPROVED', "decidedAt" = "createdAt";

CREATE INDEX "MealRecord_status_idx" ON "MealRecord"("status");
