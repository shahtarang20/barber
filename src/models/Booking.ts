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
  viaLink?: boolean;
  viaShopId?: mongoose.Types.ObjectId;
  startMinutes?: number;
  // The catalogue service the customer picked, copied at booking time so later edits or deletes never change old bookings.
  serviceId?: mongoose.Types.ObjectId;
  serviceNameSnapshot?: string;
  serviceDurationSnapshot?: number;
  servicePriceSnapshot?: number;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema: Schema = new Schema(
  {
    bookingNumber: { type: String, required: true, unique: true },
    barberId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // covered by the compound indexes below
    slotId: { type: Schema.Types.ObjectId, ref: "Slot", required: true }, // covered by { slotId, status }
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    date: { type: String, required: true }, // covered by the compound indexes below
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: {
      type: String,
      enum: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
      default: "CONFIRMED",
    },
    notes: { type: String },
    // Made by a customer through the barber's / shop's public link (counted against the admin's monthly limit).
    viaLink: { type: Boolean },
    viaShopId: { type: Schema.Types.ObjectId },
    // startTime as minutes since midnight, so lists sort chronologically ("9:00 AM" before "10:00 AM").
    startMinutes: { type: Number },
    serviceId: { type: Schema.Types.ObjectId },
    serviceNameSnapshot: { type: String, maxlength: 80 },
    serviceDurationSnapshot: { type: Number },
    servicePriceSnapshot: { type: Number },
  },
  { timestamps: true }
);

BookingSchema.index({ barberId: 1, date: 1, startMinutes: 1 });
BookingSchema.index({ barberId: 1, status: 1, date: 1 });
BookingSchema.index({ slotId: 1, status: 1 });
BookingSchema.index({ barberId: 1, viaLink: 1, createdAt: 1 });
BookingSchema.index({ viaShopId: 1, createdAt: 1 }, { sparse: true });
BookingSchema.index({ status: 1, date: 1 });

export const Booking =
  mongoose.models.Booking || mongoose.model<IBooking>("Booking", BookingSchema);
