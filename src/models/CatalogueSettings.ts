import mongoose, { Schema } from "mongoose";

/** Switch and branding of one barber's / shop's public catalogue. */
const CatalogueSettingsSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    enabled: { type: Boolean, default: false },
    logoUrl: { type: String, maxlength: 500 },
    coverUrl: { type: String, maxlength: 500 },
    intro: { type: String, trim: true, maxlength: 400 },
    address: { type: String, trim: true, maxlength: 200 },
    mapUrl: { type: String, maxlength: 500 },
    phone: { type: String, maxlength: 20 },
    whatsapp: { type: String, maxlength: 20 },
    instagram: { type: String, maxlength: 200 },
    facebook: { type: String, maxlength: 200 },
    layout: { type: String, enum: ["grid", "list"], default: "grid" },
    imageRatio: { type: String, enum: ["portrait", "square", "wide"], default: "portrait" },
    accent: { type: String, enum: ["indigo", "emerald", "rose", "amber", "sky", "zinc"], default: "indigo" },
  },
  { timestamps: true }
);
CatalogueSettingsSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export const CatalogueSettings = mongoose.models.CatalogueSettings || mongoose.model("CatalogueSettings", CatalogueSettingsSchema);
