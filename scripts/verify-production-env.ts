/**
 * Validates process.env against production rules in src/lib/env.ts.
 * Run on Railway (one-off shell) or locally before deploy:
 *   NODE_ENV=production npm run env:verify-prod
 */
import { getEnv } from "../src/lib/env";

const env = getEnv();
console.log("Production environment OK:");
console.log(`  NODE_ENV=${env.NODE_ENV}`);
console.log(`  NEXT_PUBLIC_APP_URL=${env.NEXT_PUBLIC_APP_URL}`);
console.log(`  STORAGE_DRIVER=${env.STORAGE_DRIVER}`);
if (env.STORAGE_DRIVER === "s3") {
  console.log(`  S3_BUCKET=${env.S3_BUCKET}`);
  console.log(`  AWS_REGION=${env.AWS_REGION}`);
}
