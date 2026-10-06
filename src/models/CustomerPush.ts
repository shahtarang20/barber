import mongoose, { Schema } from "mongoose";

/**
 * A customer's device that explicitly said "yes, send me offers from this barber / shop". There are no customer
 * accounts: the device is the identity, and the customer can switch it off on the same page or in the browser settings.
 */
const CustomerPushSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    endpoint: { type: String, required: true, maxlength: 600 },
    keys: { p256dh: { type: String, required: true, maxlength: 200 }, auth: { type: String, required: true, maxlength: 100 } },
    optedInAt: { type: Date, default: Date.now },
    /** When this device last received any owner message, so one phone never gets more than one a day from the same owner. */
    lastSentAt: { type: Date },
  },
  { timestamps: false }
);
CustomerPushSchema.index({ endpoint: 1, ownerType: 1, ownerId: 1 }, { unique: true });
CustomerPushSchema.index({ ownerType: 1, ownerId: 1 });

export const CustomerPush = mongoose.models.CustomerPush || mongoose.model("CustomerPush", CustomerPushSchema);
