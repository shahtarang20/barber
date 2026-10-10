import mongoose, { Schema } from "mongoose";
import { randomTemplate } from "@/lib/catalogueTemplate";

/** Switch and branding of one barber's / shop's public catalogue. */
const CatalogueSettingsSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    enabled: { type: Boolean, default: false },
    // True once the owner has flipped the switch himself: from then on publishing a service never changes it.
    enabledByOwner: { type: Boolean, default: false },
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
    // Customer page style 1-5: random when the record is first created; older records have none and use a hash of the owner id.
    template: { type: Number, min: 1, max: 5, default: () => randomTemplate() },
    // Owner-chosen brand colour ("#rrggbb"): the installed app's colour and icon, and the buttons on the public page. Absent = style default.
    brandColor: { type: String, match: /^#[0-9a-f]{6}$/ },
    accent: { type: String, enum: ["indigo", "emerald", "rose", "amber", "sky", "zinc"], default: "indigo" },
  },
  { timestamps: true }
);
CatalogueSettingsSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export const CatalogueSettings = mongoose.models.CatalogueSettings || mongoose.model("CatalogueSettings", CatalogueSettingsSchema);
