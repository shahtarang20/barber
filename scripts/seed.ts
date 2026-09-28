import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";
import { Slot } from "../src/models/Slot";
import { Customer } from "../src/models/Customer";
import { Booking } from "../src/models/Booking";
import { Counter } from "../src/models/Counter";
import { format, addDays } from "date-fns";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

const defaultWorkingHours = [
  { day: "Monday", startTime: "10:00", endTime: "20:00", isClosed: false },
  { day: "Tuesday", startTime: "10:00", endTime: "20:00", isClosed: false },
  { day: "Wednesday", startTime: "10:00", endTime: "20:00", isClosed: false },
  { day: "Thursday", startTime: "10:00", endTime: "20:00", isClosed: false },
  { day: "Friday", startTime: "10:00", endTime: "20:00", isClosed: false },
  { day: "Saturday", startTime: "10:00", endTime: "20:00", isClosed: false },
  { day: "Sunday", isClosed: true },
];

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected!");

    // Clear existing data
    console.log("Clearing existing data...");
    await User.deleteMany({});
    await Slot.deleteMany({});
    await Customer.deleteMany({});
    await Booking.deleteMany({});
    await Counter.deleteMany({});

    console.log("Creating Counter...");
    await Counter.create({ _id: "barberCode", seq: 3 }); // Reserve 1, 2, 3
    await Counter.create({ _id: "bookingNumber", seq: 1045 });

    console.log("Creating Barbers...");
    const passwordHash = await bcrypt.hash("password123", 10);

    const barbers = await User.insertMany([
      {
        name: "Rahul Barber",
        barberCode: "b001",
        email: "rahul@example.com",
        slug: "rahul-barber",
        passwordHash,
        role: "BARBER",
        bio: "Professional Haircut & Grooming with 10 years of experience.",
        workingHours: defaultWorkingHours,
      },
      {
        name: "Amit Barber",
        barberCode: "b002",
        email: "amit@example.com",
        slug: "amit-barber",
        passwordHash,
        role: "BARBER",
        bio: "Specialist in modern fades and beard styling.",
        workingHours: defaultWorkingHours,
      },
      {
        name: "Vijay Barber",
        barberCode: "b003",
        email: "vijay@example.com",
        slug: "vijay-barber",
        passwordHash,
        role: "BARBER",
        bio: "Classic cuts and traditional hot towel shaves.",
        workingHours: defaultWorkingHours,
      },
    ]);

    console.log("Creating Customers...");
    const customers = await Customer.insertMany([
      { name: "Tarang", phone: "9876543210" },
      { name: "John Doe", phone: "9876543211" },
      { name: "Jane Smith", phone: "9876543212" },
    ]);

    const rahulId = barbers[0]._id;
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");

    console.log("Creating Slots and Bookings for Rahul...");
    
    // Create some slots for today
    const slot1 = await Slot.create({ barberId: rahulId, date: todayStr, startTime: "10:00 AM", endTime: "10:30 AM", status: "BOOKED" });
    const slot2 = await Slot.create({ barberId: rahulId, date: todayStr, startTime: "10:30 AM", endTime: "11:00 AM", status: "AVAILABLE" });
    const slot3 = await Slot.create({ barberId: rahulId, date: todayStr, startTime: "11:00 AM", endTime: "11:30 AM", status: "AVAILABLE" });
    const slot4 = await Slot.create({ barberId: rahulId, date: todayStr, startTime: "11:30 AM", endTime: "12:00 PM", status: "BLOCKED" });
    const slot5 = await Slot.create({ barberId: rahulId, date: tomorrowStr, startTime: "10:00 AM", endTime: "10:30 AM", status: "AVAILABLE" });

    // Create booking for slot1
    const booking1 = await Booking.create({
      bookingNumber: "B-1042",
      barberId: rahulId,
      slotId: slot1._id,
      customerId: customers[0]._id,
      date: todayStr,
      startTime: "10:00 AM",
      endTime: "10:30 AM",
      status: "CONFIRMED",
    });

    // Link booking to slot
    slot1.bookingId = booking1._id;
    await slot1.save();

    console.log("\n✅ Database seeded successfully!");
    console.log("\nTest Credentials:");
    console.log("-------------------");
    console.log("Barber Code: b001");
    console.log("Password:    password123");
    console.log("URL:         http://localhost:3000/b/rahul-barber");
    console.log("-------------------\n");

    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
}

seed();
