// Load .env.local only in local development. Never override process.env in production
// so Railway/platform DATABASE_URL and other secrets are not replaced by localhost defaults.
import { config as loadDotenv } from "dotenv";
if (process.env.NODE_ENV !== "production") {
  loadDotenv({ path: ".env.local", override: true });
}

import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  /** Avoid bundling pino's worker/thread-stream (breaks in Next server routes). */
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream"],
  /** Required so Webpack emits valid client chunks for R3F + Three (avoids ChunkLoadError). */
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
    ],
  },
};

export default config;
