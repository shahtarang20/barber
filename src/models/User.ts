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
  email?: string;
  phone?: string;
  passwordHash: string;
  role: "BARBER" | "ADMIN";
  slug: string;
  profileImage?: string;
  bio?: string;
  workingHours: IWorkingHours[];
  slotDuration: number;
  defaultCapacity: number;
  premiumAmount: number;
  /** Bookings per month allowed through this barber's link. undefined = platform default, 0 = unlimited. */
  linkBookingLimit?: number;
  /** Unique visitors (network addresses) allowed to open this barber's link per month. undefined = platform default, 0 = unlimited. */
  visitorLimit?: number;
  catalogueEnabled?: boolean;
  /** Last day (IST, "YYYY-MM-DD") the paid plan covers. Unset = not tracked yet: the monthly due day is used instead. */
  planEndsOn?: string;
  lastPaymentAt?: Date;
  /** The day (IST) a renewal reminder was last pushed, so the daily job sends one per day. */
  planReminderOn?: string;
  /** Free access to a paid plan given by the admin (no payment): the tier and the last day (IST) it applies. */
  grantedTier?: "PREMIUM" | "BUSINESS";
  grantedUntil?: string;
  /** Last time this barber had the dashboard open (updated every few minutes). */
  lastSeenAt?: Date;
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
    // Optional: a barber can sign up with just a name and password and log in with his Barber Code.
    email: { type: String, trim: true },
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
    // Shared source of truth for both the manual "Generate"/"Sync Schedule"
    // button on the Schedule page and the automatic slot generation that
    // runs after saving Settings — without this, the two paths silently
    // used different capacities and drifted out of sync with each other.
    defaultCapacity: { type: Number, default: 1, min: 1, max: 50 },
    premiumAmount: { type: Number, default: 0 },
    linkBookingLimit: { type: Number, min: 0 },
    visitorLimit: { type: Number, min: 0 },
    // The admin can switch the premium catalogue off for one barber (the barber's data is kept).
    catalogueEnabled: { type: Boolean, default: true },
    planEndsOn: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    lastPaymentAt: { type: Date },
    planReminderOn: { type: String },
    grantedTier: { type: String, enum: ["PREMIUM", "BUSINESS"] },
    grantedUntil: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    lastSeenAt: { type: Date },
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

UserSchema.index({ role: 1, isActive: 1 });
// Emails stay unique, but only when one was given (many barbers can have none).
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });

export const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
