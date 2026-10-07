import mongoose, { Schema } from "mongoose";

/**
 * One unique visitor (a network address) that opened a barber's or shop's public link in a month. The address itself is
 * never stored: only a one-way hash, which is enough to tell "seen before" from "new" and nothing more.
 */
const LinkVisitorSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    /** India calendar month, "YYYY-MM": the count starts again on the 1st. */
    month: { type: String, required: true },
    ipHash: { type: String, required: true },
    firstSeenAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);
LinkVisitorSchema.index({ ownerType: 1, ownerId: 1, month: 1, ipHash: 1 }, { unique: true });
// Old months are not needed any more (the admin only looks at the current one).
LinkVisitorSchema.index({ firstSeenAt: 1 }, { expireAfterSeconds: 100 * 24 * 3600 });

export const LinkVisitor = mongoose.models.LinkVisitor || mongoose.model("LinkVisitor", LinkVisitorSchema);
