import connectToDatabase from "../src/lib/mongodb";
import { Slot } from "../src/models/Slot";
import { User } from "../src/models/User";
import mongoose from "mongoose";

async function test() {
  await mongoose.connect("mongodb+srv://shahtarang20_db_user:Barber2026@cluster0.dbv62.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");
  const user = await User.findOne();
  console.log("User:", user?.name);

  // simulate generate logic
  const newSlots = [];
  newSlots.push({
    barberId: user._id,
    date: "2026-10-01",
    startTime: "10:00 AM",
    endTime: "10:30 AM",
    status: "AVAILABLE",
    capacity: 3,
    bookingsCount: 0,
  });

  try {
    await Slot.insertMany(newSlots);
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
test().catch(console.error);
