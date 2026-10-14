import mongoose, { Schema } from "mongoose";

/**
 * One owner's spin-to-win wheel. Each segment has a weight (its share of the odds) and a prize; a "NONE" prize is a
 * "better luck next time" slice, which keeps the giveaway affordable. The winning slice is ALWAYS decided on the server
 * (see wheel.ts) — the customer's wheel only animates to the result — so the odds can never be gamed from the phone.
 */
const WheelSegmentSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 40 },
    weight: { type: Number, required: true, min: 0, max: 1000 },
    rewardType: { type: String, enum: ["NONE", "FREE_SERVICE", "PERCENTAGE", "FIXED"], default: "NONE" },
    rewardValue: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const WheelConfigSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    enabled: { type: Boolean, default: false },
    segments: { type: [WheelSegmentSchema], default: [] },
    // A customer may spin again only after this many days (0 = one spin per booking, always).
    cooldownDays: { type: Number, default: 30, min: 0, max: 365 },
    // Total spins the owner will ever give out across all customers (0 = unlimited). Once reached, the wheel stops appearing.
    maxSpinsTotal: { type: Number, default: 0, min: 0, max: 1_000_000 },
    // How many times any one customer may ever spin (0 = unlimited). Combined with cooldownDays, which spaces the spins out.
    maxSpinsPerCustomer: { type: Number, default: 1, min: 0, max: 1000 },
    // Days a won prize stays valid; 0 = never expires.
    rewardValidDays: { type: Number, default: 30, min: 0, max: 365 },
  },
  { timestamps: true }
);
WheelConfigSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export const WheelConfig = mongoose.models.WheelConfig || mongoose.model("WheelConfig", WheelConfigSchema);
