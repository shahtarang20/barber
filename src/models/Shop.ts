import mongoose, { Schema, Document } from "mongoose";

export interface IShop extends Document {
  name: string;
  slug: string;
  ownerId: mongoose.Types.ObjectId;
  barberIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  /** Bookings per month allowed through the shop link. undefined = platform default, 0 = unlimited. */
  linkBookingLimit?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ShopSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    barberIds: [{ type: Schema.Types.ObjectId, ref: "User", index: true }],
    isActive: { type: Boolean, default: true },
    linkBookingLimit: { type: Number, min: 0 },
  },
  { timestamps: true }
);

export const Shop = mongoose.models.Shop || mongoose.model<IShop>("Shop", ShopSchema);
