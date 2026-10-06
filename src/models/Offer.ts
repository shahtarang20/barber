import mongoose, { Schema } from "mongoose";

/**
 * A time-limited offer (festival, new-style launch, weekday discount) on some or all services of one catalogue.
 * It is live between startsOn and endsOn (IST dates, both included) while status is ACTIVE.
 */
const OfferSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 200 },
    discountType: { type: String, enum: ["PERCENTAGE", "FIXED"], required: true },
    discountValue: { type: Number, required: true, min: 1 },
    /** Empty = every priced service of the catalogue. */
    serviceIds: [{ type: Schema.Types.ObjectId }],
    startsOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    endsOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ["ACTIVE", "PAUSED"], default: "ACTIVE" },
  },
  { timestamps: true }
);
OfferSchema.index({ ownerType: 1, ownerId: 1, endsOn: -1 });

export const Offer = mongoose.models.Offer || mongoose.model("Offer", OfferSchema);
