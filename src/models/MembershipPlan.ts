import mongoose, { Schema } from "mongoose";

/**
 * One owner's membership / package offer: a customer pays once (manually, at the counter — no payment gateway) and gets
 * a window of `durationDays` during which `includedVisits` visits are covered (0 = unlimited for the window). `serviceIds`
 * empty = every service is covered, otherwise only the listed ones. One owner may run several plans; `active` hides a plan
 * from being sold again without deleting the memberships already sold on it. One document per plan, per owner scope.
 */
const MembershipPlanSchema = new Schema(
  {
    ownerType: { type: String, enum: ["BARBER", "SHOP"], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Price the customer pays for the whole window (₹), clamped in the lib.
    price: { type: Number, required: true, min: 1 },
    // How many days the membership stays valid from the day it is sold.
    durationDays: { type: Number, required: true, min: 1, max: 3650 },
    // Visits covered inside the window; 0 = unlimited for the window.
    includedVisits: { type: Number, default: 0, min: 0, max: 1000 },
    // Services this membership covers; empty = all of the owner's services.
    serviceIds: { type: [Schema.Types.ObjectId], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
MembershipPlanSchema.index({ ownerType: 1, ownerId: 1, active: 1 });

export const MembershipPlan = mongoose.models.MembershipPlan || mongoose.model("MembershipPlan", MembershipPlanSchema);
