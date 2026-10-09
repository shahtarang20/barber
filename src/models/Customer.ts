import mongoose, { Schema, Document } from "mongoose";

export interface ICustomer extends Document {
  name: string;
  phone: string;
  ownerBarberId?: mongoose.Types.ObjectId;
  email?: string;
  barberNotes?: { barberId: mongoose.Types.ObjectId; note: string }[];
  // Visits that were completed with a barber but whose booking records have since been cleaned up.
  barberStats?: { barberId: mongoose.Types.ObjectId; visits: number; lastVisit?: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    // May be empty: a barber can record a customer who has no phone (then the customer belongs to that barber only).
    phone: { type: String, default: "", index: true },
    ownerBarberId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    email: { type: String },
    barberStats: [
      {
        barberId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        visits: { type: Number, default: 0 },
        lastVisit: { type: String },
        _id: false,
      },
    ],
    barberNotes: [
      {
        barberId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        note: { type: String },
      }
    ]
  },
  { timestamps: true }
);

CustomerSchema.index({ phone: 1, name: 1 });
// The barber / shop customer lists union in customers whose old bookings were cleaned up ({ "barberStats.barberId": ... }); without this every list view scanned the whole customers collection.
CustomerSchema.index({ "barberStats.barberId": 1 });
// createConfirmedBooking looks a customer up with a case-insensitive collation. MongoDB can only use an index for such a
// query if the index was built with the SAME collation, otherwise every booking scans the whole customers collection.
CustomerSchema.index({ phone: 1, name: 1, ownerBarberId: 1 }, { collation: { locale: "en", strength: 2 }, name: "phone_name_owner_ci" });

export const Customer =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);
