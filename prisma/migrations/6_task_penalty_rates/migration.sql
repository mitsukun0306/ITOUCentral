-- タスクごとの納品遅延・支給率(%)。未設定(NULL)なら既定値を使用。
ALTER TABLE "Task" ADD COLUMN "penalty24" INTEGER;
ALTER TABLE "Task" ADD COLUMN "penalty72" INTEGER;
ALTER TABLE "Task" ADD COLUMN "penaltyOver" INTEGER;
