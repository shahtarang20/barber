import mongoose, { Schema } from "mongoose";

/**
 * A short-lived message for ONE barber's open dashboard that carries customer details (for example "this customer cancelled,
 * offer the slot to these waitlisted people"). The live-update service (Pusher) only ever receives the id of this record,
 * never a name or phone number; the dashboard then fetches the details from our own server, which hands them only to that barber.
 */
const DashboardAlertSchema = new Schema(
  {
    barberId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, expires: 15 * 60 }, // gone after 15 minutes
  },
  { versionKey: false }
);

export const DashboardAlert = mongoose.models.DashboardAlert || mongoose.model("DashboardAlert", DashboardAlertSchema);
