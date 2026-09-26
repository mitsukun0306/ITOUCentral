-- 承認/却下後の領収書自動削除クエリを高速化するための複合インデックス
CREATE INDEX "MealRecord_status_decidedAt_idx" ON "MealRecord"("status", "decidedAt");
