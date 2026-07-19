# ITOUCentral

いとう開発部 社内専用ポータル。**タスク管理・勤怠・給与(成果報酬)管理**を1つのアプリで行います。

- 対象: 社内関係者専用(業務委託の成果報酬運用が前提)
- 技術: Next.js 16 (App Router) / React 19 / TypeScript / Tailwind CSS / Prisma / SQLite(将来 PostgreSQL へ移行可能)

---

## 主な機能

| 機能 | 管理者 | メンバー(業務委託) |
| --- | --- | --- |
| ダッシュボード | 全体のタスク状況・今月の見込み総額 | 自分のタスク状況・見込み報酬 |
| タスク管理 | 作成・編集・削除・担当割当・報酬設定 | 自分のタスクのステータス変更 |
| 勤怠 | 全メンバーの記録閲覧・編集 | 出勤/退勤の打刻・自分の記録編集 |
| 給与 | 月次計算・手入力・確定 | 自分の月次報酬の確認 |
| メンバー管理 | 追加・権限変更・有効/無効・PW再設定 | ― |
| 設定 | 組織名・既定の給与計算方式 | ― |

### 給与計算方式(管理者が選択可能)

設定画面で既定方式を選べ、給与画面では月ごとに方式を切り替えて計算・保存できます。

1. **タスク固定報酬の合算** — 完了タスクに設定した固定報酬を合算
2. **単価 × 成果量 の合算** — 完了タスクの `単価 × 成果量` を合算
3. **月次手入力** — 自動計算せず管理者が金額を手入力して確定

給与レコードは「下書き(DRAFT)」→「確定(CONFIRMED)」の2段階。確定済みは再計算で上書きされません。

---

## データベース

**PostgreSQL** を使用します(開発・本番とも)。本番は Render のマネージド PostgreSQL。

### ローカル開発

PostgreSQL が必要です。Docker があれば同梱の `docker-compose.yml` で起動できます。

```bash
cp .env.example .env    # 環境変数を用意(必要に応じて編集)
docker compose up -d    # ローカル PostgreSQL を起動(任意)
npm install             # 依存関係(prisma generate も自動実行)
npm run db:migrate      # マイグレーション適用
npm run db:seed         # 初期データ投入(管理者 + 開発用サンプル)
npm run dev             # http://localhost:3000
```

Docker を使わない場合は、任意の PostgreSQL の接続文字列を `.env` の `DATABASE_URL` に設定してください(Render の外部接続URLを開発に使うことも可能)。

### 初期ログイン情報(開発の seed 実行後)

| 役割 | メール | パスワード |
| --- | --- | --- |
| 管理者 | `admin@itou.dev` | `admin1234` |
| メンバー | `taro@itou.dev` | `member1234` |

> 本番の管理者は環境変数 `ADMIN_EMAIL` / `ADMIN_PASSWORD` で作成されます(下記)。開発用サンプルは本番(`NODE_ENV=production`)では投入されません。

---

## 環境変数

| 変数 | 用途 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `AUTH_SECRET` | セッションJWTの署名鍵(長いランダム文字列)|
| `ADMIN_EMAIL` | 初期管理者のメール(seed 時に使用)|
| `ADMIN_PASSWORD` | 初期管理者のパスワード |
| `ADMIN_NAME` | 初期管理者の表示名(任意)|

`AUTH_SECRET` の生成例:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Render へのデプロイ

同梱の [`render.yaml`](render.yaml)(Blueprint)で、PostgreSQL と Web サービスをまとめて作成します。

### 手順

1. **GitHub にプッシュ**(下記「GitHubへのプッシュ」参照)。
2. Render で **New +** → **Blueprint** → 対象リポジトリを選択。
3. `render.yaml` が読み込まれ、DB と Web サービスが提案される。作成時に以下を入力:
   - `ADMIN_EMAIL` … 管理者ログイン用メール
   - `ADMIN_PASSWORD` … 管理者ログイン用パスワード
   - `ADMIN_NAME` … 表示名(任意)
   - `DATABASE_URL` / `AUTH_SECRET` は自動設定されるため入力不要。
4. **Apply** でデプロイ開始。ビルド後に自動で以下が実行される:
   - `prisma migrate deploy`(スキーマ適用)
   - `prisma db seed`(管理者・設定の初期化。冪等)
5. 発行された URL にアクセスし、上記の管理者情報でログイン。

### デプロイの仕組み(render.yaml)

- **buildCommand**: `npm ci --include=dev && npx prisma generate && npm run build`
- **preDeployCommand**: `npx prisma migrate deploy && npx prisma db seed`
- **startCommand**: `npm start`
- `DATABASE_URL` は DB から自動注入、`AUTH_SECRET` は自動生成。

> 💡 プラン: `render.yaml` は本運用向けに有料プラン(DB `basic-256mb` / Web `starter`)を指定しています。無料で試す場合は各 `plan:` を `free` に変更してください(無料DBは約30日で失効)。

### 以降の更新

`main` ブランチに push するたびに Render が自動で再ビルド・再デプロイします(マイグレーションも自動適用)。

---

## GitHub へのプッシュ

まだリポジトリが無い場合:

```bash
git init
git add -A
git commit -m "Initial commit: ITOUCentral"
git branch -M main
# GitHub で空のリポジトリを作成し、その URL を設定
git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
git push -u origin main
```

> `.env`(秘密情報)や `dev.db`、生成物は `.gitignore` 済みでコミットされません。

---

## 技術メモ

- 認証: `jose` による JWT を httpOnly Cookie に保存(7日間)。`app/(app)/layout.tsx` で未ログインを `/login` へリダイレクト。
- パスワード: `bcryptjs` でハッシュ化。
- データ変更: Next.js Server Actions を使用(`app/**/actions.ts`)。
- 給与計算ロジック: `lib/payroll.ts`。
- DBスキーマ: `prisma/schema.prisma`。

### ディレクトリ構成

```
app/
  login/            ログイン
  (app)/            認証必須エリア(共通レイアウト+サイドバー)
    dashboard/  tasks/  attendance/  payroll/  members/  settings/
lib/                db, auth, payroll, format
components/         共通UI(StatusBadge, MonthNav)
prisma/             schema, migrations, seed
```
