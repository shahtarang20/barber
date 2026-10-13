import mongoose, { Schema } from "mongoose";

/**
 * One owner's automatic-offer settings. For now this holds only the birthday greeting: when `birthdayEnabled`, the daily
 * cron finds customers whose birthday is today and sends them `birthdayMessage` (optionally attaching `birthdayOfferId`).
 * `lastBirthdayRun` is the IST date (YYYY-MM-DD) the greeting last went out, so a day's run can never fire twice.
 * Absent / disabled = the owner runs no automatic birthday offers. One document per owner scope.
 */
const AutoOfferSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    birthdayEnabled: { type: Boolean, default: false },
    // The warm note the customer receives on their birthday (kept short so it fits a push notification).
    birthdayMessage: { type: String, default: "", trim: true, maxlength: 120 },
    // Optional coupon/offer to attach to the greeting; empty = just the message.
    birthdayOfferId: { type: Schema.Types.ObjectId },
    // Last IST date (YYYY-MM-DD) the birthday run fired; empty = never. Guards against a double run on the same day.
    lastBirthdayRun: { type: String, default: "", match: /^(\d{4}-\d{2}-\d{2})?$/ },
  },
  { timestamps: true }
);
AutoOfferSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });

export const AutoOffer = mongoose.models.AutoOffer || mongoose.model("AutoOffer", AutoOfferSchema);
