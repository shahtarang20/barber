"use client";

import { withScope, type CatalogueScope } from "@/lib/catalogueClient";

const MAX_BODY = 3.5 * 1024 * 1024; // stay under the 4.5 MB a serverless function can receive
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

async function readJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error?.message || "Upload failed. Please try again.");
  return json.data;
}

/** Shrinks a big phone photo in the browser (longest side 2000 px, JPEG) so it fits in one upload; the server then optimises it again. */
async function shrinkIfNeeded(file: File): Promise<Blob> {
  if (file.size <= MAX_BODY) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That picture could not be read. Try another one.");
  let edge = 2000;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (blob && blob.size <= MAX_BODY) { bitmap.close(); return blob; }
    edge = Math.round(edge * 0.75);
  }
  bitmap.close();
  throw new Error("That picture is too large. Please choose a smaller one.");
}

export interface UploadedMedia { _id: string; url: string; thumbUrl?: string }

export async function uploadPicture(scope: CatalogueScope, file: File): Promise<UploadedMedia> {
  const body = new FormData();
  body.append("file", await shrinkIfNeeded(file), file.name);
  const data = await readJson(await fetch(withScope("/api/barber/catalogue/media", scope), { method: "POST", body }));
  return data.asset as UploadedMedia;
}

/** Videos go straight from the phone to cloud storage (with progress), then the server checks them. */
export async function uploadVideo(scope: CatalogueScope, file: File, onProgress: (percent: number) => void): Promise<UploadedMedia> {
  if (file.size > VIDEO_MAX_BYTES) throw new Error("Videos can be up to 50 MB. Record a shorter clip.");
  const type = file.type || "video/mp4";
  const start = await readJson(await fetch(withScope("/api/barber/catalogue/media/video", scope), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: type, size: file.size }) }));
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", start.uploadUrl);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The video could not be uploaded. Please try again.")));
    xhr.onerror = () => reject(new Error("Network problem while uploading. Please try again."));
    xhr.send(file);
  });
  const done = await readJson(await fetch(withScope("/api/barber/catalogue/media/video/confirm", scope), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: start.id }) }));
  return done.asset as UploadedMedia;
}
