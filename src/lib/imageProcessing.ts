import sharp from "sharp";
import { IMAGE_FULL_EDGE, IMAGE_MAX_INPUT_PIXELS, IMAGE_QUALITY, IMAGE_THUMB_EDGE } from "@/lib/mediaConfig";

export type ImageKind = "jpeg" | "png" | "webp";

/**
 * What the file REALLY is, from its first bytes. The type the browser claims (or the file name) is never trusted:
 * an HTML page or SVG with a script renamed to .jpg is rejected here.
 */
export function sniffImage(buf: Buffer): ImageKind | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

export interface OptimisedImage { full: Buffer; thumb: Buffer; width: number; height: number }

export class ImageError extends Error {}

/**
 * Turns an uploaded picture into the two files customers get: a sharp, small WebP (longest side 1600 px) and a 480 px
 * thumbnail for cards on slow phones. Phone-camera rotation is applied, and ALL metadata (including GPS location) is dropped.
 */
export async function optimiseImage(input: Buffer): Promise<OptimisedImage> {
  if (!sniffImage(input)) throw new ImageError("Please choose a JPEG, PNG or WebP picture.");
  try {
    const base = () => sharp(input, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS, failOn: "error" }).rotate(); // rotate() reads the camera orientation, then the tag is dropped
    const meta = await sharp(input, { limitInputPixels: IMAGE_MAX_INPUT_PIXELS, failOn: "error" }).metadata();
    if (!meta.width || !meta.height) throw new ImageError("That picture could not be read.");
    if (meta.width < 64 || meta.height < 64) throw new ImageError("That picture is too small. Use one at least 64 pixels wide and tall.");

    const full = await base().resize({ width: IMAGE_FULL_EDGE, height: IMAGE_FULL_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality: IMAGE_QUALITY }).toBuffer({ resolveWithObject: true });
    const thumb = await base().resize({ width: IMAGE_THUMB_EDGE, height: IMAGE_THUMB_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    return { full: full.data, thumb, width: full.info.width, height: full.info.height };
  } catch (err) {
    if (err instanceof ImageError) throw err;
    throw new ImageError("That picture could not be read. Try another one, or take a new photo.");
  }
}
