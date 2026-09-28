import mongoose from "mongoose";
import { Slot } from "../src/models/Slot";

async function run() {
  await mongoose.connect("mongodb+srv://shahtarang20_db_user:Barber2026@cluster0.dbv62.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0");
  const slots = await Slot.find({ date: "2026-10-01" });
  console.log("SLOTS:", JSON.stringify(slots, null, 2));
  process.exit(0);
}
run().catch(console.error);
