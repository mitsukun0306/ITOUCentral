-- 食事補助: 「食べたもの/場所」の手入力フォームを廃止し、領収書写真の添付に変更。
-- 既存データは保持したいので item/place は NOT NULL 制約のみ外す(削除はしない)。
ALTER TABLE "MealRecord" ALTER COLUMN "item" DROP NOT NULL;
ALTER TABLE "MealRecord" ALTER COLUMN "place" DROP NOT NULL;
ALTER TABLE "MealRecord" ADD COLUMN "receiptImage" BYTEA;
ALTER TABLE "MealRecord" ADD COLUMN "receiptMime" TEXT;
