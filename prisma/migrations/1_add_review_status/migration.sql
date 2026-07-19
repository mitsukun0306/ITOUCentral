-- 完了申請ワークフロー用に TaskStatus へ REVIEW を追加
ALTER TYPE "TaskStatus" ADD VALUE 'REVIEW' BEFORE 'DONE';
