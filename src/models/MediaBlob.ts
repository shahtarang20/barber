import mongoose, { Schema } from "mongoose";

/** The file bytes of a picture when cloud storage (R2) is not configured. Small, optimised pictures only (never videos). */
const MediaBlobSchema = new Schema(
  {
    _id: { type: String, required: true }, // the storage key, e.g. "3f2c….webp"
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const MediaBlob = mongoose.models.MediaBlob || mongoose.model("MediaBlob", MediaBlobSchema);
