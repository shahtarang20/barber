import mongoose, { Schema, Document } from "mongoose";

export interface ISlot extends Document {
  barberId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format
  startTime: string; // e.g. '10:00 AM'
  endTime: string; // e.g. '10:30 AM'
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
  capacity: number;
  bookingsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const SlotSchema: Schema = new Schema(
  {
    barberId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: { type: String, enum: ["AVAILABLE", "BOOKED", "BLOCKED"], default: "AVAILABLE", index: true },
    capacity: { type: Number, default: 1 },
    bookingsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Slot = mongoose.models.Slot || mongoose.model<ISlot>("Slot", SlotSchema);
