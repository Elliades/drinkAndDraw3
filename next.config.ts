// Ensure .env.local values always take precedence over pre-set shell environment
// variables (Next.js doesn't override existing process.env entries on its own).
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

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
