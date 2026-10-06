import { requireMongoUri } from "./env";
import mongoose from "mongoose";
import { Slot } from "../src/models/Slot";

async function run() {
  await mongoose.connect(requireMongoUri());
  const slots = await Slot.find({ date: "2026-10-01" });
  console.log("SLOTS:", JSON.stringify(slots, null, 2));
  process.exit(0);
}
run().catch(console.error);
