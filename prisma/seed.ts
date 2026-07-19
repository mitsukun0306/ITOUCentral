import { PrismaClient } from "../lib/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const isProd = process.env.NODE_ENV === "production";

async function main() {
  // 全体設定(1レコード)
  await prisma.setting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      companyName: "いとう開発部",
      defaultPayrollMethod: "TASK_FIXED",
    },
  });

  // 初期管理者(本番は環境変数で指定。既存があればパスワードは変更しない)
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@itou.dev";
  const adminName = process.env.ADMIN_NAME ?? "管理者";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin1234";

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {}, // 既存管理者のパスワードは上書きしない(アプリ内変更を尊重)
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });
  console.log(`管理者を確認/作成: ${adminEmail}`);

  // サンプルデータは開発環境のみ
  if (isProd) {
    console.log("本番環境のためサンプルデータはスキップしました");
    return;
  }

  const memberPass = await bcrypt.hash("member1234", 10);
  const member = await prisma.user.upsert({
    where: { email: "taro@itou.dev" },
    update: {},
    create: {
      name: "委託 太郎",
      email: "taro@itou.dev",
      passwordHash: memberPass,
      role: "MEMBER",
    },
  });

  const existingTasks = await prisma.task.count();
  if (existingTasks === 0) {
    const now = new Date();
    await prisma.task.createMany({
      data: [
        {
          title: "ランディングページ制作",
          description: "トップページのデザインと実装",
          status: "DONE",
          assigneeId: member.id,
          fixedReward: 50000,
          completedAt: new Date(now.getFullYear(), now.getMonth(), 5),
        },
        {
          title: "記事執筆(10本)",
          description: "技術ブログ記事",
          status: "DONE",
          assigneeId: member.id,
          unitPrice: 3000,
          quantity: 10,
          completedAt: new Date(now.getFullYear(), now.getMonth(), 12),
        },
        {
          title: "問い合わせフォーム改修",
          description: "バリデーション追加",
          status: "IN_PROGRESS",
          assigneeId: member.id,
          fixedReward: 20000,
        },
      ],
    });
  }

  console.log("開発用サンプルデータを投入しました");
  console.log("  管理者:  admin@itou.dev / admin1234");
  console.log("  メンバー: taro@itou.dev / member1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
