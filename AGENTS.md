<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ITOUCentral

いとう開発部 社内ポータル(タスク・勤怠・給与)。詳細は `README.md` を参照。

## スタック
- Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS v4
- Prisma 6 + PostgreSQL(開発・本番とも)。ローカルは docker-compose の Postgres。本番は Render マネージド PostgreSQL(`render.yaml` Blueprint)。
- 認証: `jose` JWT を httpOnly Cookie に保存 + `bcryptjs`

## 規約
- データ変更は **Server Actions**(`app/**/actions.ts`)。API Route は使わない方針。
- Prisma Client は `@/lib/generated/prisma` からインポート(`lib/db.ts` のシングルトン経由)。
- 認証は `lib/auth.ts` の `requireUser()` / `getSessionUser()`。管理者チェックは各 action 内で `role === "ADMIN"` を確認。
- 給与計算は `lib/payroll.ts` に集約(`computePayroll`, `taskAmount`)。方式は `PayrollMethod`。
- 金額は整数(円)で保持。表示は `lib/format.ts` の `yen()`。
- 認証必須ページは `app/(app)/` 配下(レイアウトで未ログインをリダイレクト)。

## よく使うコマンド
- `npm run dev` 開発サーバー
- `npm run db:migrate` マイグレーション / `npm run db:seed` 初期データ / `npm run db:studio` GUI
- `npx tsc --noEmit` 型チェック / `npm run build` 本番ビルド
