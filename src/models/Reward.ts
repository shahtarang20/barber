import mongoose, { Schema } from "mongoose";

/**
 * A one-time coupon held on a customer's account, earned from loyalty (a completed card), a wheel spin, or an auto-offer.
 * It is redeemed at the counter by the barber (never a customer-side money movement), so a reward can never be spent twice:
 * the redeem is an atomic status flip from ACTIVE to REDEEMED. Shared by loyalty, the wheel and future features.
 */
const RewardSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    source: { type: String, enum: ["LOYALTY", "WHEEL", "OFFER"], required: true },
    // What the reward is worth. FREE_SERVICE uses `label` only; PERCENTAGE / FIXED use `value`.
    rewardType: { type: String, enum: ["FREE_SERVICE", "PERCENTAGE", "FIXED"], required: true },
    value: { type: Number, default: 0, min: 0 },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    status: { type: String, enum: ["ACTIVE", "REDEEMED", "EXPIRED"], default: "ACTIVE" },
    // IST date (YYYY-MM-DD) after which an unredeemed reward is dead; empty = never expires.
    expiresOn: { type: String, default: "", match: /^(\d{4}-\d{2}-\d{2})?$/ },
    redeemedAt: { type: Date },
    redeemedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
// The customer's own live rewards (shown on the public page) and the owner's "coupons issued vs redeemed" view.
RewardSchema.index({ ownerType: 1, ownerId: 1, customerId: 1, status: 1 });
RewardSchema.index({ ownerType: 1, ownerId: 1, status: 1, createdAt: -1 });

export const Reward = mongoose.models.Reward || mongoose.model("Reward", RewardSchema);
