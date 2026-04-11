import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Permite que Server Actions leiam do banco via Prisma
  },
};

export default nextConfig;
