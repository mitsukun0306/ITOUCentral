-- 承認/却下後の領収書自動削除クエリを高速化するための複合インデックス
-- NOTE: 以前は "10_meal_receipt_cleanup_index" という名前だったが、Prisma はフォルダ名の
-- 辞書順で適用するため "1_..." より先に実行され、新規DBで MealRecord 未作成のまま失敗していた。
-- 既に旧名で適用済みのDB(本番)でも安全に再実行できるよう IF NOT EXISTS を付けている。
CREATE INDEX IF NOT EXISTS "MealRecord_status_decidedAt_idx" ON "MealRecord"("status", "decidedAt");
