import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 領収書写真(ブラウザ側で圧縮済み)を送信できるように既定の1MBから拡張
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
