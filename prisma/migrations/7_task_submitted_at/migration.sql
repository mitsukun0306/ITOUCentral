-- 完了申請時刻(報酬の仮確定・期限カウント停止の基準)
ALTER TABLE "Task" ADD COLUMN "submittedAt" TIMESTAMP(3);
