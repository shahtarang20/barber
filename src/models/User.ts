import mongoose, { Schema, Document } from "mongoose";
import { Counter } from "./Counter";

export interface IWorkingHours {
  day: string; // e.g., 'Monday', 'Tuesday'
  isClosed: boolean;
  startTime?: string; // '10:00 AM'
  endTime?: string; // '08:00 PM'
  breaks?: { startTime: string; endTime: string }[];
}

export interface IUser extends Document {
  name: string;
  barberCode: string; // Auto-generated b001
  email: string;
  phone?: string;
  passwordHash: string;
  role: "BARBER" | "ADMIN";
  slug: string;
  profileImage?: string;
  bio?: string;
  timezone: string;
  workingHours: IWorkingHours[];
  settings?: Record<string, any>;
  premiumAmount: number;
  premiumDueDay: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WorkingHoursSchema = new Schema({
  day: { type: String, required: true },
  isClosed: { type: Boolean, default: false },
  startTime: { type: String },
  endTime: { type: String },
  breaks: [
    {
      startTime: String,
      endTime: String,
    },
  ],
});

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    barberCode: { type: String, unique: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["BARBER", "ADMIN"], default: "BARBER" },
    slug: { type: String, required: true, unique: true },
    profileImage: { type: String },
    bio: { type: String },
    timezone: { type: String, default: "Asia/Kolkata" },
    workingHours: [WorkingHoursSchema],
    settings: { type: Schema.Types.Mixed },
    premiumAmount: { type: Number, default: 0 },
    premiumDueDay: { type: Number, default: 28 }, // default 28th of month
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Pre-save hook to generate sequential barberCode
UserSchema.pre("save", async function () {
  const user = this;
  if (user.isNew && user.role === "BARBER" && !user.barberCode) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "barberCode" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    const seqString = counter.seq.toString().padStart(3, "0");
    user.barberCode = `b${seqString}`;
  }
});

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
