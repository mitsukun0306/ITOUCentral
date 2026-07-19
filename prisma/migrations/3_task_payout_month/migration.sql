-- タスクの支給月(管理者指定)。未指定なら完了月に計上。
ALTER TABLE "Task" ADD COLUMN "payoutYear" INTEGER;
ALTER TABLE "Task" ADD COLUMN "payoutMonth" INTEGER;
CREATE INDEX "Task_payoutYear_payoutMonth_idx" ON "Task"("payoutYear", "payoutMonth");
