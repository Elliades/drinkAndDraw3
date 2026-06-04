import { z } from "zod";

const StorageDriverSchema = z.enum(["local", "s3"]);

/** Coerce empty-string env vars to undefined so optional validators don't fail. */
const optionalStr = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());
const optionalUrl = z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional());

const ServerEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

    DATABASE_URL: z.string().url(),

    AUTH_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
    AUTH_GOOGLE_ID: optionalStr,
    AUTH_GOOGLE_SECRET: optionalStr,
    /** Development-only: enables password sign-in on /login when NODE_ENV=development (min 8 chars). */
    AUTH_DEV_SECRET: optionalStr,
    /** Optional email for the dev user (defaults to dev@drinkanddraw.local). */
    AUTH_DEV_EMAIL: optionalStr,
    EMAIL_SERVER: optionalStr,
    EMAIL_FROM: optionalStr,

    STORAGE_DRIVER: StorageDriverSchema.default("local"),
    LOCAL_IMAGE_DIR: z.string().default("./sample-images"),
    /** Writable cache for reference thumbnails (originals may be read-only). */
    THUMB_CACHE_DIR: z.string().default("./.cache/thumbs"),

    AWS_REGION: z.string().default("us-east-1"),
    AWS_ACCESS_KEY_ID: optionalStr,
    AWS_SECRET_ACCESS_KEY: optionalStr,
    S3_BUCKET: optionalStr,
    S3_PREFIX: z.string().default("references/"),
    S3_PUBLIC_URL: optionalUrl,

    SENTRY_DSN: optionalStr,
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production" && data.AUTH_DEV_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_DEV_SECRET"],
        message: "AUTH_DEV_SECRET must not be set in production",
      });
    }
    if (data.NODE_ENV === "production") {
      if (!data.AUTH_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["AUTH_SECRET"],
          message: "AUTH_SECRET is required in production (NextAuth)",
        });
      }
      try {
        const app = new URL(data.NEXT_PUBLIC_APP_URL);
        if (app.hostname === "localhost" || app.hostname === "127.0.0.1") {
          ctx.addIssue({
            code: "custom",
            path: ["NEXT_PUBLIC_APP_URL"],
            message: "Set NEXT_PUBLIC_APP_URL to your public HTTPS URL in production (not localhost)",
          });
        }
      } catch {
        /* z.string().url() already validated */
      }
    }
    if (data.STORAGE_DRIVER === "s3") {
      if (!data.S3_BUCKET) {
        ctx.addIssue({ code: "custom", path: ["S3_BUCKET"], message: "S3_BUCKET is required when STORAGE_DRIVER=s3" });
      }
      // Access keys are optional: the AWS SDK uses the default credential chain (env vars, IAM role, etc.).
    }
  });

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvCacheForTests(): void {
  cached = null;
}
