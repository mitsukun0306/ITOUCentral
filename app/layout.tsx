import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ITOUCentral",
  description: "いとう開発部 社内ポータル(タスク・勤怠・給与管理)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
