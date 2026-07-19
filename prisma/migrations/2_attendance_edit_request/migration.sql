-- メンバーからの勤怠時刻変更申請フィールドを追加
ALTER TABLE "Attendance" ADD COLUMN "editRequested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Attendance" ADD COLUMN "reqClockIn" TIMESTAMP(3);
ALTER TABLE "Attendance" ADD COLUMN "reqClockOut" TIMESTAMP(3);
ALTER TABLE "Attendance" ADD COLUMN "reqNote" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "reqAt" TIMESTAMP(3);
