import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_CIRCLE_WALLET_ID_ETH: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ID_ETH,
    NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_ETH: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_ETH,
    NEXT_PUBLIC_CIRCLE_WALLET_ID_POLYGON: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ID_POLYGON,
    NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_POLYGON: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_POLYGON,
    NEXT_PUBLIC_CIRCLE_WALLET_ID_ARC: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ID_ARC,
    NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_ARC: process.env.NEXT_PUBLIC_CIRCLE_WALLET_ADDRESS_ARC,
  },
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // Turbopack is now the default in Next.js 16
  // With lazy Circle SDK loading, Node modules won't be bundled for client
  turbopack: {},
};

export default nextConfig;
