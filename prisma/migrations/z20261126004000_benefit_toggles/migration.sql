-- 福利厚生の項目ごとのオンオフ(既定はすべてオン)
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "benefitRetreatEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "benefitExpenseEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Setting" ADD COLUMN IF NOT EXISTS "benefitMealEnabled" BOOLEAN NOT NULL DEFAULT true;
