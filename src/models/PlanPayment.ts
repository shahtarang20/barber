import mongoose, { Schema } from "mongoose";

/**
 * One payment the admin recorded for a barber's plan (the money itself is collected outside the app: cash, UPI, bank).
 * Rows are never edited or deleted: a mistake is VOIDED, which keeps the history honest for audits.
 */
const PlanPaymentSchema = new Schema(
  {
    barberId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    months: { type: Number, required: true, min: 1, max: 24 },
    method: { type: String, enum: ["CASH", "UPI", "BANK", "OTHER", "COMPLIMENTARY"], required: true },
    reference: { type: String, trim: true, maxlength: 80 },
    note: { type: String, trim: true, maxlength: 200 },
    /** The days this payment covers, IST "YYYY-MM-DD", both included. */
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    status: { type: String, enum: ["PAID", "VOID"], default: "PAID" },
    voidedAt: { type: Date },
    voidReason: { type: String, maxlength: 200 },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recordedByName: { type: String, required: true },
  },
  { timestamps: true }
);
PlanPaymentSchema.index({ barberId: 1, createdAt: -1 });

export const PlanPayment = mongoose.models.PlanPayment || mongoose.model("PlanPayment", PlanPaymentSchema);
