import mongoose, { Schema, Document } from "mongoose";

export interface IShop extends Document {
  name: string;
  slug: string;
  ownerId: mongoose.Types.ObjectId;
  barberIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  /** What the owner lets other barbers of the shop do with the shop catalogue and numbers (effective only while the plan allows it). */
  staff?: { userId: mongoose.Types.ObjectId; catalogue: boolean; analytics: boolean }[];
  /** Bookings per month allowed through the shop link. undefined = platform default, 0 = unlimited. */
  linkBookingLimit?: number;
  /** Unique visitors (network addresses) allowed to open the shop link per month. undefined = platform default, 0 = unlimited. */
  visitorLimit?: number;
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
    staff: [{ userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, catalogue: { type: Boolean, default: false }, analytics: { type: Boolean, default: false }, _id: false }],
    linkBookingLimit: { type: Number, min: 0 },
    visitorLimit: { type: Number, min: 0 },
  },
  { timestamps: true }
);

ShopSchema.index({ createdAt: -1 }); // admin list

export const Shop = mongoose.models.Shop || mongoose.model<IShop>("Shop", ShopSchema);
