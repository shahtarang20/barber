import { randomUUID } from "crypto";
import { MediaAsset } from "@/models/MediaAsset";
import { CatalogueError, planFor, type Scope } from "@/lib/catalogue";
import { MEDIA_GRACE_MS, VIDEO_ALLOWED_TYPES, VIDEO_MAX_BYTES, VIDEO_MAX_SECONDS, VIDEO_MIN_SECONDS, videoUploadsAvailable } from "@/lib/mediaConfig";
import { activeDriver, deleteObjects, headObject, presignPut, publicUrlFor, putObject, readRange } from "@/lib/mediaStorage";
import { optimiseImage, ImageError } from "@/lib/imageProcessing";
import { looksLikeMp4, mp4DurationSeconds } from "@/lib/mp4Duration";

const MB = 1024 * 1024;
/** Keys always start with this app's own prefix and the owner's id, so files can never mix with another project's. */
const keyFor = (scope: Scope, ext: string) => `barber/${scope.ownerType.toLowerCase()}/${scope.ownerId}/${randomUUID()}.${ext}`;
const owner = (scope: Scope) => ({ ownerType: scope.ownerType, ownerId: scope.ownerId });

async function assertQuota(scope: Scope, addBytes: number) {
  const plan = await planFor(scope);
  const [agg] = await MediaAsset.aggregate([{ $match: owner(scope) }, { $group: { _id: null, bytes: { $sum: { $add: ["$sizeBytes", { $ifNull: ["$thumbSizeBytes", 0] }] } } } }]);
  const used = agg?.bytes ?? 0;
  if (used + addBytes > plan.maxMediaMB * MB) throw new CatalogueError(403, `Your plan has ${plan.maxMediaMB} MB for pictures and videos and it is full. Delete files you no longer use, or upgrade.`);
}

export async function listAssets(scope: Scope) {
  const [items, plan] = await Promise.all([MediaAsset.find({ ...owner(scope), status: "READY" }).sort({ createdAt: -1 }).lean(), planFor(scope)]);
  const usedBytes = items.reduce((n, a) => n + (a.sizeBytes || 0) + (a.thumbSizeBytes || 0), 0);
  return { items, usedMB: Math.round((usedBytes / MB) * 10) / 10, limitMB: plan.maxMediaMB, videosAvailable: videoUploadsAvailable() };
}

export async function uploadImage(scope: Scope, bytes: Buffer) {
  let out;
  try { out = await optimiseImage(bytes); } catch (e) { if (e instanceof ImageError) throw new CatalogueError(400, e.message); throw e; }
  await assertQuota(scope, out.full.length + out.thumb.length);
  const driver = activeDriver();
  const storageKey = keyFor(scope, "webp");
  const thumbKey = keyFor(scope, "webp");
  await Promise.all([putObject(driver, storageKey, out.full, "image/webp"), putObject(driver, thumbKey, out.thumb, "image/webp")]);
  try {
    return await MediaAsset.create({ ...owner(scope), kind: "IMAGE", driver, storageKey, thumbKey, url: publicUrlFor(driver, storageKey), thumbUrl: publicUrlFor(driver, thumbKey), contentType: "image/webp", sizeBytes: out.full.length, thumbSizeBytes: out.thumb.length, width: out.width, height: out.height });
  } catch (err) { await deleteObjects(driver, [storageKey, thumbKey]).catch(() => 0); throw err; }
}

/** Step 1 of a video: reserve it and give the browser a short-lived address to upload to. */
export async function startVideo(scope: Scope, contentType: string, sizeBytes: number) {
  if (!videoUploadsAvailable()) throw new CatalogueError(503, "Video upload is not set up yet. Ask the admin to connect cloud storage.");
  if (!(VIDEO_ALLOWED_TYPES as readonly string[]).includes(contentType)) throw new CatalogueError(400, "Please choose an MP4 or MOV video.");
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new CatalogueError(400, "That video looks empty.");
  if (sizeBytes > VIDEO_MAX_BYTES) throw new CatalogueError(400, `Videos can be up to ${VIDEO_MAX_BYTES / MB} MB. Record a shorter clip.`);
  const plan = await planFor(scope);
  if (plan.maxVideosPerService === 0) throw new CatalogueError(403, "Videos are part of the Premium plan.");
  await assertQuota(scope, sizeBytes);
  const storageKey = keyFor(scope, contentType === "video/quicktime" ? "mov" : "mp4");
  const asset = await MediaAsset.create({ ...owner(scope), kind: "VIDEO", driver: "R2", storageKey, url: publicUrlFor("R2", storageKey), contentType, sizeBytes, status: "PENDING" });
  return { id: String(asset._id), uploadUrl: await presignPut(storageKey, contentType) };
}

/** Step 2: the browser says it finished. Check what really arrived: size, that it is a video, and its length. */
export async function finishVideo(scope: Scope, id: string) {
  const asset = await MediaAsset.findOne({ _id: id, ...owner(scope), kind: "VIDEO", status: "PENDING" });
  if (!asset) throw new CatalogueError(404, "Upload not found. Please try again.");
  const reject = async (msg: string) => { await deleteObjects("R2", [asset.storageKey]).catch(() => 0); await asset.deleteOne(); throw new CatalogueError(400, msg); };
  const head = await headObject(asset.storageKey);
  if (!head) throw new CatalogueError(400, "The video did not finish uploading. Please try again.");
  if (head.size > VIDEO_MAX_BYTES) return reject(`Videos can be up to ${VIDEO_MAX_BYTES / MB} MB.`);
  const first = await readRange(asset.storageKey, 0, Math.min(head.size, 512 * 1024) - 1);
  if (!looksLikeMp4(first)) return reject("That file is not a valid MP4 or MOV video.");
  let seconds = mp4DurationSeconds(first);
  if (seconds === null && head.size > first.length) seconds = mp4DurationSeconds(await readRange(asset.storageKey, Math.max(0, head.size - 2 * MB), head.size - 1));
  if (seconds === null) return reject("We could not read the length of that video. Please use a standard MP4.");
  if (seconds < VIDEO_MIN_SECONDS || seconds > VIDEO_MAX_SECONDS) return reject(`Videos must be between ${VIDEO_MIN_SECONDS} and ${VIDEO_MAX_SECONDS} seconds (about 30 seconds is best).`);
  asset.sizeBytes = head.size;
  asset.durationSeconds = Math.round(seconds * 10) / 10;
  asset.status = "READY";
  await asset.save();
  return asset;
}

export async function deleteAsset(scope: Scope, id: string) {
  const asset = await MediaAsset.findOneAndDelete({ _id: id, ...owner(scope) });
  if (!asset) throw new CatalogueError(404, "File not found.");
  await deleteObjects(asset.driver, [asset.storageKey, asset.thumbKey]).catch((e) => console.error("Media delete failed:", e));
  return asset;
}

/** Removes unfinished uploads and files no service or branding uses any more. Safe to run often. */
export async function cleanupMedia(): Promise<{ removed: number }> {
  const { BarberService } = await import("@/models/BarberService");
  const { CatalogueSettings } = await import("@/models/CatalogueSettings");
  const cutoff = new Date(Date.now() - MEDIA_GRACE_MS);
  const old = await MediaAsset.find({ createdAt: { $lt: cutoff } }).limit(500).lean();
  if (old.length === 0) return { removed: 0 };
  const [svc, set] = await Promise.all([
    BarberService.find({ $or: [{ images: { $exists: true, $ne: [] } }, { videos: { $exists: true, $ne: [] } }] }, { images: 1, videos: 1 }).lean(),
    CatalogueSettings.find({}, { logoUrl: 1, coverUrl: 1 }).lean(),
  ]);
  const used = new Set<string>();
  for (const s of svc) for (const u of [...(s.images || []), ...(s.videos || [])]) used.add(u);
  for (const s of set) { if (s.logoUrl) used.add(s.logoUrl); if (s.coverUrl) used.add(s.coverUrl); }
  let removed = 0;
  for (const a of old) {
    if (a.status === "READY" && used.has(a.url)) continue;
    await deleteObjects(a.driver, [a.storageKey, a.thumbKey]).catch(() => 0);
    await MediaAsset.deleteOne({ _id: a._id });
    removed++;
  }
  return { removed };
}
