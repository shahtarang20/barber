/** Everything adjustable about media in one place. */

/** A serverless function can only receive about 4.5 MB: bigger pictures are shrunk in the browser first. */
export const IMAGE_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** Refuse absurdly large pictures (decompression bombs) before decoding them. */
export const IMAGE_MAX_INPUT_PIXELS = 50_000_000;
export const IMAGE_FULL_EDGE = 1600; // longest side of the picture customers see
export const IMAGE_THUMB_EDGE = 480; // small version for cards on slow phones
export const IMAGE_QUALITY = 80;

/** Videos go straight from the phone to R2 (a function cannot receive 50 MB). */
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const VIDEO_MIN_SECONDS = 5;
export const VIDEO_MAX_SECONDS = 120; // the admin's range is 5-120 s; the recommended length is 30 s
export const VIDEO_ALLOWED_TYPES = ["video/mp4", "video/quicktime"] as const;

/** Pending uploads that were never finished, and pictures nobody uses, are removed after this long. */
export const MEDIA_GRACE_MS = 60 * 60 * 1000;

export interface R2Config { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl: string }

/**
 * Cloudflare R2 settings, from this app's OWN environment variables (never copied from another project):
 *   R2_ENDPOINT          https://<account-id>.r2.cloudflarestorage.com
 *   R2_BUCKET            the bucket name
 *   R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY   an API token limited to that bucket
 *   R2_PUBLIC_BASE_URL   the public address of the bucket (r2.dev address or your own domain), without a trailing slash
 */
export function r2Config(): R2Config | null {
  const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL } = process.env;
  if (!R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_BASE_URL) return null;
  return { endpoint: R2_ENDPOINT, bucket: R2_BUCKET, accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, publicBaseUrl: R2_PUBLIC_BASE_URL.replace(/\/+$/, "") };
}

export const videoUploadsAvailable = () => r2Config() !== null;
