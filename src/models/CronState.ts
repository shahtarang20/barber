import mongoose, { Schema } from "mongoose";

/**
 * Durable progress marker for the daily job, so a run that can't finish every
 * barber inside one function call simply resumes from where it stopped on the
 * next trigger instead of starting over (or silently skipping barbers).
 */
const CronStateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    date: { type: String, required: true }, // IST day this run belongs to
    cursor: { type: Schema.Types.ObjectId, default: null }, // last barber _id fully processed
    processed: { type: Number, default: 0 },
    done: { type: Boolean, default: false },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export const CronState = mongoose.models.CronState || mongoose.model("CronState", CronStateSchema);
