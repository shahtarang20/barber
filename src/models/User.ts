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
  workingHours: IWorkingHours[];
  slotDuration: number;
  premiumAmount: number;
  premiumDueDay: number;
  isActive: boolean;
  tokenVersion: number;
  shopId?: mongoose.Types.ObjectId;
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
    workingHours: [WorkingHoursSchema],
    // Configurable per barber — a high-volume quick-trim shop needs shorter
    // slots than the 30-min default suits, and forcing everyone onto one
    // fixed grid undersells real capacity for busy single-chair shops.
    slotDuration: { type: Number, default: 30, min: 10, max: 60 },
    premiumAmount: { type: Number, default: 0 },
    premiumDueDay: { type: Number, default: 28 }, // default 28th of month
    isActive: { type: Boolean, default: true },
    // Bumped on logout, password reset, or suspension to invalidate any
    // outstanding JWTs immediately — tokens carry the version they were
    // issued with, so a mismatch means "log this session out".
    tokenVersion: { type: Number, default: 0 },
    // null/unset = a solo barber, unchanged from today's behavior. Set once
    // a barber joins or creates a Shop grouping multiple barbers together.
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", default: null, index: true },
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
