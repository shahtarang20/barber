import mongoose, { Schema } from "mongoose";

/**
 * One customer's progress on one owner's loyalty card. A completed visit adds a stamp (guarded to at most one per IST day
 * by `lastStampDate`); when stamps reach the program's target a Reward coupon is issued and the stamps reset. Kept per
 * (owner, customer) so a shared family phone never merges — the card belongs to the customer record, not the raw number.
 */
const LoyaltyCardSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    stamps: { type: Number, default: 0, min: 0 },
    redeemedCount: { type: Number, default: 0, min: 0 },
    // IST date (YYYY-MM-DD) of the most recent stamp, so two visits the same day earn only one.
    lastStampDate: { type: String, default: "" },
  },
  { timestamps: true }
);
LoyaltyCardSchema.index({ ownerType: 1, ownerId: 1, customerId: 1 }, { unique: true });

export const LoyaltyCard = mongoose.models.LoyaltyCard || mongoose.model("LoyaltyCard", LoyaltyCardSchema);
