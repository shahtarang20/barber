import mongoose, { Schema } from "mongoose";

/** One service or hairstyle card in the public catalogue. */
const BarberServiceSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "CatalogueCategory", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500 },
    images: [{ type: String, maxlength: 500 }],
    videos: [{ type: String, maxlength: 500 }],
    durationMinutes: { type: Number, required: true, min: 5, max: 600 },
    priceType: { type: String, enum: ["FIXED_PRICE", "STARTING_FROM", "ASK_SHOP"], default: "FIXED_PRICE" },
    price: { type: Number, min: 0 },
    originalPrice: { type: Number, min: 0 },
    discountType: { type: String, enum: ["PERCENTAGE", "FIXED"] },
    discountValue: { type: Number, min: 0 },
    // Which barbers of the shop perform it. Empty = any barber.
    barberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isFeatured: { type: Boolean, default: false },
    isPopular: { type: Boolean, default: false },
    isNew: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
    displayOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);
BarberServiceSchema.index({ ownerType: 1, ownerId: 1, status: 1, displayOrder: 1 });

export const BarberService = mongoose.models.BarberService || mongoose.model("BarberService", BarberServiceSchema);
