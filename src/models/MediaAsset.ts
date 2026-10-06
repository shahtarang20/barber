import mongoose, { Schema } from "mongoose";

/**
 * One uploaded picture or video of a barber's / shop's catalogue. The file itself lives in storage (R2, or the MongoDB
 * fallback for pictures); this record knows who owns it, where it is, how big it is, and whether it is finished.
 * Keys always start with this app's own prefix ("barber/"), never with any other project's.
 */
const MediaAssetSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["IMAGE", "VIDEO"], required: true },
    driver: { type: String, enum: ["R2", "MONGO"], required: true },
    storageKey: { type: String, required: true, unique: true },
    thumbKey: { type: String },
    url: { type: String, required: true },
    thumbUrl: { type: String },
    contentType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    thumbSizeBytes: { type: Number, default: 0 },
    width: { type: Number },
    height: { type: Number },
    durationSeconds: { type: Number },
    // Videos are PENDING until the browser has uploaded the file and the server has checked it.
    status: { type: String, enum: ["PENDING", "READY"], default: "READY" },
  },
  { timestamps: true }
);
MediaAssetSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });
MediaAssetSchema.index({ status: 1, createdAt: 1 });

export const MediaAsset = mongoose.models.MediaAsset || mongoose.model("MediaAsset", MediaAssetSchema);
