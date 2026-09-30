import mongoose, { Schema } from "mongoose";

/** A shop owner's invitation to a barber. The barber must accept before joining the shop. */
const ShopInviteSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    barberId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, // the invited barber
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"], default: "PENDING", index: true },
  },
  { timestamps: true }
);

// Only one pending invitation per shop + barber.
ShopInviteSchema.index({ shopId: 1, barberId: 1 }, { unique: true, partialFilterExpression: { status: "PENDING" } });

export const ShopInvite = mongoose.models.ShopInvite || mongoose.model("ShopInvite", ShopInviteSchema);
