import mongoose, { Schema } from "mongoose";

/** A notification an owner sent to opted-in customers. Kept so the weekly limit can be enforced and the owner can see what went out. */
const CampaignSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    sentBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, maxlength: 140 },
    offerId: { type: Schema.Types.ObjectId },
    audience: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
CampaignSchema.index({ ownerType: 1, ownerId: 1, createdAt: -1 });

export const Campaign = mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);
