const mongoose = require("mongoose");
const { Schema, Document } = mongoose;

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/barber");
  console.log("Connected to DB");

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

  const UserSchema = new Schema(
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

  const User = mongoose.models.User || mongoose.model("User", UserSchema);

  const barbers = await User.find({ role: "BARBER" });
  console.log(`Found ${barbers.length} barbers.`);

  for (const b of barbers) {
    console.log(`- ${b.name}: Premium ₹${b.premiumAmount} due on ${b.premiumDueDay}, Active: ${b.isActive}`);
  }

  process.exit(0);
}

test().catch(console.error);
