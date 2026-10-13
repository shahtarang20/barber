import mongoose, { Schema } from "mongoose";

/**
 * One customer's bought membership on one owner's plan. Keyed on `customerId` (never the raw phone) so a shared family
 * number never merges two members. `remainingVisits` counts down as covered bookings are completed (-1 = unlimited for the
 * window); `expiresOn` is an IST date (YYYY-MM-DD). `planNameSnapshot` freezes the plan's name at sale time, so later edits
 * or a deactivation of the plan never rewrite a sold membership. Payment is recorded manually (CASH / UPI / OTHER).
 */
const MembershipSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "MembershipPlan", required: true },
    planNameSnapshot: { type: String, required: true, trim: true, maxlength: 60 },
    // IST dates (YYYY-MM-DD): the day it was sold and the last day it covers.
    startsOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    expiresOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    // Visits left in the window; -1 = unlimited.
    remainingVisits: { type: Number, default: -1 },
    status: { type: String, enum: ["ACTIVE", "EXPIRED", "CANCELLED"], default: "ACTIVE" },
    paymentMode: { type: String, enum: ["CASH", "UPI", "OTHER"], default: "CASH" },
    // The user (owner or staff) who sold it.
    soldBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
// The customer's own live membership (booking flow + member list), and the owner's "who is a member, expiring when" view.
MembershipSchema.index({ ownerType: 1, ownerId: 1, customerId: 1, status: 1 });
MembershipSchema.index({ ownerType: 1, ownerId: 1, status: 1, expiresOn: 1 });

export const Membership = mongoose.models.Membership || mongoose.model("Membership", MembershipSchema);
