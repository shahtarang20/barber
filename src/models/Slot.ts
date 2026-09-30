import mongoose, { Schema, Document } from "mongoose";

export interface ISlot extends Document {
  barberId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD format
  startTime: string; // e.g. '10:00 AM'
  endTime: string; // e.g. '10:30 AM'
  status: "AVAILABLE" | "BOOKED" | "BLOCKED";
  capacity: number;
  bookingsCount: number;
  waitlist: {
    name: string;
    phone: string;
    joinedAt: Date;
  }[];
  isCustomCapacity?: boolean;
  shiftedAt?: Date; // set when the barber shifted the day ("running late"); auto-reconcile leaves that date alone
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
    waitlist: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    isCustomCapacity: { type: Boolean, default: false },
    shiftedAt: { type: Date },
  },
  { timestamps: true }
);

// Enforces uniqueness at the database level — two concurrent "Generate
// Slots" requests (double-click, two tabs) can both pass an in-app
// existence check before either has inserted; only a DB constraint can
// actually prevent the resulting duplicate, independently-bookable slot.
SlotSchema.index({ barberId: 1, date: 1, startTime: 1 }, { unique: true });
SlotSchema.index({ date: 1, bookingsCount: 1 }); // daily cleanup of old unbooked slots

export const Slot = mongoose.models.Slot || mongoose.model<ISlot>("Slot", SlotSchema);
