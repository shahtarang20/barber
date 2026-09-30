import mongoose, { Schema } from "mongoose";

/** A small cached snapshot (e.g. the admin dashboard numbers) so heavy counts aren't rerun on every page view. */
const StatSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    data: { type: Schema.Types.Mixed, required: true },
    computedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const Stat = mongoose.models.Stat || mongoose.model("Stat", StatSchema);
