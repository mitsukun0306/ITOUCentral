-- 給与からの天引き
CREATE TABLE IF NOT EXISTS "PayrollDeduction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PayrollDeduction_userId_year_month_idx" ON "PayrollDeduction"("userId", "year", "month");
CREATE INDEX IF NOT EXISTS "PayrollDeduction_year_month_idx" ON "PayrollDeduction"("year", "month");

DO $$ BEGIN
    ALTER TABLE "PayrollDeduction" ADD CONSTRAINT "PayrollDeduction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
