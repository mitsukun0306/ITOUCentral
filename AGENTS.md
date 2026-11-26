# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# ITOUCentral

いとう開発部 社内ポータル(タスク・勤怠・給与・福利厚生)。機能やデプロイ手順の詳細は `README.md` を参照。
`CLAUDE.md` はこのファイルを読み込むだけなので、エージェント向けの情報はここに書く。

## スタック
- Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS v4
- Prisma 6 + PostgreSQL(開発・本番とも)。ローカルは docker-compose の Postgres。本番は Render マネージド PostgreSQL(`render.yaml` Blueprint、`main` への push で自動デプロイ)。
- 認証: `jose` JWT を httpOnly Cookie に保存 + `bcryptjs`
- テスト: Vitest(`lib/**/*.test.ts`)

## ディレクトリ
```
app/login/                 ログイン(公開)
app/(app)/                 認証必須エリア。layout.tsx で未ログインを /login へ
  dashboard/ tasks/ attendance/ payroll/ benefits/
  notifications/ audit/ members/ settings/ logout/
  各フォルダ: page.tsx(サーバー) + *Panel/*Board.tsx 等(クライアント) + actions.ts(Server Actions)
lib/                       ドメインロジック(db, auth, payroll, attendance, rank, format, notifications, audit)
components/                共通UI(StatusBadge, MonthNav, Countdown, RankBadge)
prisma/                    schema.prisma, migrations/, seed.ts
lib/generated/prisma/      Prisma Client 生成物(gitignore。npm install 時に生成)
```

## 規約
- データ変更は **Server Actions**(`app/**/actions.ts`)。API Route は使わない方針。
- Prisma Client は `@/lib/generated/prisma` からインポート(`lib/db.ts` のシングルトン経由)。
- 認証は `lib/auth.ts` の `requireUser()` / `getSessionUser()`。管理者チェックは各 action 内で `role === "ADMIN"` を確認。
- 重要な操作は `lib/audit.ts` の `logAudit()` で監査ログに残す。
- 給与計算は `lib/payroll.ts` に集約(`computePayroll`, `taskAmount`, `taskPayable`, `lateInfo`)。方式は `PayrollMethod`。
- 金額は整数(円)で保持。表示は `lib/format.ts` の `yen()`。
- 日時は **JST 基準**。暦日・月の判定は `lib/format.ts` の `toJstDateInput` / `jstMidnight` / `jstYearMonth`、月の範囲は `monthRange` を使う(`new Date().getMonth()` などローカルTZ依存の処理は使わない)。
- UI 文言・コメントは日本語。

## マイグレーションの注意
- Prisma はマイグレーションを **フォルダ名の辞書順** で適用する。`10_...` は `1_...` より先になるので連番を増やすと壊れる。
- 新しいマイグレーションは `z<YYYYMMDDHHMMSS>_<name>` という名前にする(既存の `0_`〜`9a_` より必ず後ろに並ぶ)。
  1. `npx prisma migrate dev --create-only --name <name>` で作成
  2. 生成されたフォルダ名を `z<タイムスタンプ>_<name>` にリネーム
  3. `npm run db:migrate` で適用
- 適用済みのマイグレーション(本番に入ったもの)の SQL やフォルダ名は変更しない。
- CI は空のDBに全マイグレーションを適用し、`schema.prisma` との差分が無いことを確認する。

## よく使うコマンド
- `npm run dev` 開発サーバー(http://localhost:3000)
- `docker compose up -d` ローカル Postgres 起動
- `npm run db:migrate` マイグレーション / `npm run db:seed` 初期データ / `npm run db:reset` DB作り直し / `npm run db:studio` GUI
- `npm run typecheck` 型チェック / `npm run lint` / `npm test` ユニットテスト / `npm run check` 3つまとめて
- `npm run build` 本番ビルド

## 作業の進め方
- 変更後は最低限 `npm run check` と `npm run build` を通す。DBスキーマを変えたら空DBで `npx prisma migrate reset --force` が通ることも確認。
- 純粋関数(計算・日付処理)を変えたら `lib/*.test.ts` にテストを追加・更新する。
- GitHub Actions(`.github/workflows/ci.yml`)が PR と `main` への push で型チェック・lint・テスト・マイグレーション・ビルドを実行する。
