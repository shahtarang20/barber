import mongoose, { Schema, Document } from "mongoose";

export interface IBooking extends Document {
  bookingNumber: string;
  barberId: mongoose.Types.ObjectId;
  slotId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  date: string;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  notes?: string;
  startMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema: Schema = new Schema(
  {
    bookingNumber: { type: String, required: true, unique: true, index: true },
    barberId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    slotId: { type: Schema.Types.ObjectId, ref: "Slot", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
      default: "CONFIRMED",
      index: true,
    },
    notes: { type: String },
    // startTime as minutes since midnight, so lists sort chronologically ("9:00 AM" before "10:00 AM").
    startMinutes: { type: Number },
  },
  { timestamps: true }
);

BookingSchema.index({ barberId: 1, date: 1 });
BookingSchema.index({ barberId: 1, date: 1, startMinutes: 1 });
BookingSchema.index({ barberId: 1, status: 1, date: 1 });
BookingSchema.index({ slotId: 1, status: 1 });
BookingSchema.index({ status: 1, date: 1 });

export const Booking =
  mongoose.models.Booking || mongoose.model<IBooking>("Booking", BookingSchema);
