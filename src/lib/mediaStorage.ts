import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { MediaBlob } from "@/models/MediaBlob";
import { r2Config, type R2Config } from "@/lib/mediaConfig";

/**
 * Where uploaded files live.
 *  R2    Cloudflare R2 (S3-compatible): pictures and videos, served from the bucket's public address.
 *  MONGO fallback when R2 is not configured: optimised pictures kept in MongoDB and served by /api/public/media/<key>.
 *        Meant for getting started; videos need R2.
 */
export type Driver = "R2" | "MONGO";
export const activeDriver = (): Driver => (r2Config() ? "R2" : "MONGO");

let cached: { key: string; client: S3Client } | null = null;
function s3(cfg: R2Config): S3Client {
  const key = `${cfg.endpoint}|${cfg.bucket}|${cfg.accessKeyId}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      client: new S3Client({
        region: "auto", // R2 ignores the region
        endpoint: cfg.endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
        // R2 does not accept the SDK's newer automatic checksum headers on plain uploads.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
      }),
    };
  }
  return cached.client;
}
const needR2 = (): R2Config => {
  const cfg = r2Config();
  if (!cfg) throw new Error("Cloud storage (R2) is not configured.");
  return cfg;
};

/** The address customers load the file from. (Stored keys contain no "_", so "/" can safely travel as "_" in the MongoDB address.) */
export function publicUrlFor(driver: Driver, key: string): string {
  return driver === "R2" ? `${needR2().publicBaseUrl}/${key}` : `/api/public/media/${key.replace(/\//g, "_")}`;
}

export async function putObject(driver: Driver, key: string, body: Buffer, contentType: string): Promise<void> {
  if (driver === "MONGO") {
    await MediaBlob.updateOne({ _id: key }, { $set: { data: body, contentType, size: body.length }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return;
  }
  const cfg = needR2();
  await s3(cfg).send(new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
}

/** Removes files; a file that is already gone is not an error. Returns how many requests failed. */
export async function deleteObjects(driver: Driver, keys: string[]): Promise<number> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return 0;
  if (driver === "MONGO") { await MediaBlob.deleteMany({ _id: { $in: unique } }); return 0; }
  const cfg = needR2();
  const results = await Promise.allSettled(unique.map((Key) => s3(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key }))));
  return results.filter((r) => r.status === "rejected").length;
}

/** A short-lived address the browser can upload ONE file to directly (used for videos, which a function cannot receive). */
export async function presignPut(key: string, contentType: string, expiresInSeconds = 900): Promise<string> {
  const cfg = needR2();
  return getSignedUrl(s3(cfg), new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType }), { expiresIn: expiresInSeconds, signableHeaders: new Set(["content-type"]) });
}

/** Size and type of a stored file, or null if it is not there. */
export async function headObject(key: string): Promise<{ size: number; contentType?: string } | null> {
  const cfg = needR2();
  try {
    const r = await s3(cfg).send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key }));
    return { size: Number(r.ContentLength ?? 0), contentType: r.ContentType };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (err as { name?: string }).name === "NotFound") return null;
    throw err;
  }
}

/** A byte range of a stored file (to read a video's length without downloading all of it). */
export async function readRange(key: string, start: number, end: number): Promise<Buffer> {
  const cfg = needR2();
  const r = await s3(cfg).send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key, Range: `bytes=${start}-${end}` }));
  const bytes = await r.Body?.transformToByteArray();
  return Buffer.from(bytes ?? []);
}
