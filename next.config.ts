// Ensure .env.local values always take precedence over pre-set shell environment
// variables (Next.js doesn't override existing process.env entries on its own).
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: ".env.local", override: true });

import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
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
