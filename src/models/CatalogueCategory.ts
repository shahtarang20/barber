import mongoose, { Schema } from "mongoose";

/** A group of services ("Haircut", "Beard", "Bridal packages"...) owned by one barber or one shop. */
const CatalogueCategorySchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true },
    description: { type: String, trim: true, maxlength: 300 },
    coverUrl: { type: String, maxlength: 500 },
    displayOrder: { type: Number, required: true, default: 0 },
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);
CatalogueCategorySchema.index({ ownerType: 1, ownerId: 1, slug: 1 }, { unique: true });
CatalogueCategorySchema.index({ ownerType: 1, ownerId: 1, displayOrder: 1 });

export const CatalogueCategory = mongoose.models.CatalogueCategory || mongoose.model("CatalogueCategory", CatalogueCategorySchema);
