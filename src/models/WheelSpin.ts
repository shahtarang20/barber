import mongoose, { Schema } from "mongoose";

/**
 * One recorded spin of the wheel: kept so the cooldown ("one spin every N days") can be enforced and the owner can see
 * how many spins turned into prizes. One row per spin, win or lose.
 */
const WheelSpinSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    date: { type: String, required: true }, // IST YYYY-MM-DD of the spin
    segmentLabel: { type: String, default: "" },
    won: { type: Boolean, default: false },
    rewardId: { type: Schema.Types.ObjectId, ref: "Reward" },
  },
  { timestamps: true }
);
// Cooldown lookup: the customer's most recent spin for this owner.
WheelSpinSchema.index({ ownerType: 1, ownerId: 1, customerId: 1, createdAt: -1 });

export const WheelSpin = mongoose.models.WheelSpin || mongoose.model("WheelSpin", WheelSpinSchema);
