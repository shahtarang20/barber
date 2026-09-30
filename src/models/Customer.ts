import mongoose, { Schema, Document } from "mongoose";

export interface ICustomer extends Document {
  name: string;
  phone: string;
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
    phone: { type: String, required: true, index: true },
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

export const Customer =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);
