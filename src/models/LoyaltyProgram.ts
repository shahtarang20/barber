import mongoose, { Schema } from "mongoose";

/**
 * One owner's loyalty punch card settings: collect `stampsNeeded` stamps (one per completed visit, at most one a day)
 * and earn the reward. Absent / disabled = the owner runs no loyalty card. One document per owner scope.
 */
const LoyaltyProgramSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    enabled: { type: Boolean, default: false },
    stampsNeeded: { type: Number, default: 10, min: 2, max: 50 },
    rewardType: { type: String, enum: ["FREE_SERVICE", "PERCENTAGE", "FIXED"], default: "FREE_SERVICE" },
    rewardValue: { type: Number, default: 0, min: 0 },
    // Shown to the customer and copied onto the earned reward coupon, e.g. "Free haircut" or "₹100 off".
    rewardLabel: { type: String, default: "", trim: true, maxlength: 60 },
    // Days a newly earned reward stays valid; 0 = never expires.
    rewardValidDays: { type: Number, default: 0, min: 0, max: 365 },
  },
  { timestamps: true }
);
LoyaltyProgramSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export const LoyaltyProgram = mongoose.models.LoyaltyProgram || mongoose.model("LoyaltyProgram", LoyaltyProgramSchema);
