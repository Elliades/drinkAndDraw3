import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  contentTypeFromKey,
  isImageKey,
  type PutObjectInput,
  type ReadObjectResult,
  type StorageObject,
  type StorageProvider,
} from "./types";

export interface S3StorageConfig {
  region: string;
  bucket: string;
  prefix: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
}

const DEFAULT_PRESIGN_TTL_SECONDS = 3600;

export class S3StorageProvider implements StorageProvider {
  readonly name = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly publicUrl?: string;

  constructor(config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      ...(config.accessKeyId && config.secretAccessKey
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    });
    this.bucket = config.bucket;
    this.prefix = config.prefix.replace(/^\/+/, "");
    this.publicUrl = config.publicUrl;
  }

  private fullKey(key: string): string {
    const norm = key.replace(/\\/g, "/").replace(/^\/+/, "");
    return `${this.prefix}${norm}`;
  }

  private fromFullKey(fullKey: string): string {
    return fullKey.startsWith(this.prefix) ? fullKey.slice(this.prefix.length) : fullKey;
  }

  async list(prefix?: string): Promise<StorageObject[]> {
    const out: StorageObject[] = [];
    const fullPrefix = this.fullKey(prefix ?? "");
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: fullPrefix,
          ContinuationToken: token,
        }),
      );
      for (const obj of res.Contents ?? []) {
        if (!obj.Key) continue;
        const key = this.fromFullKey(obj.Key);
        if (!isImageKey(key)) continue;
        out.push({
          key,
          size: obj.Size,
          contentType: contentTypeFromKey(key),
          lastModified: obj.LastModified,
        });
      }
      token = res.NextContinuationToken;
    } while (token);
    return out;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }));
      return true;
    } catch {
      return false;
    }
  }

  async head(key: string): Promise<StorageObject | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      );
      return {
        key,
        size: res.ContentLength,
        contentType: res.ContentType ?? contentTypeFromKey(key),
        lastModified: res.LastModified,
      };
    } catch {
      return null;
    }
  }

  async read(key: string): Promise<ReadObjectResult> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
    );
    const body = res.Body;
    if (!body) throw new Error(`Empty body for s3://${this.bucket}/${this.fullKey(key)}`);
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks);
    return {
      body: buf,
      contentType: res.ContentType ?? contentTypeFromKey(key),
      size: buf.byteLength,
      lastModified: res.LastModified,
    };
  }

  async put(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.fullKey(input.key),
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
    );
  }

  async getUrl(key: string, opts?: { expiresInSeconds?: number }): Promise<string> {
    if (this.publicUrl) {
      return `${this.publicUrl.replace(/\/+$/, "")}/${this.fullKey(key)
        .split("/")
        .map((s) => encodeURIComponent(s))
        .join("/")}`;
    }
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
      { expiresIn: opts?.expiresInSeconds ?? DEFAULT_PRESIGN_TTL_SECONDS },
    );
  }
}
