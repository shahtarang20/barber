import mongoose from "mongoose";
import { User } from "../src/models/User";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI as string;

async function fixAdmin() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected!");

    const admin = await User.findOne({ barberCode: "Tarang" });
    if (admin) {
      admin.barberCode = "tarang";
      await admin.save();
      console.log("Fixed barberCode to 'tarang'");
    } else {
      console.log("Admin with barberCode 'Tarang' not found");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error fixing admin:", error);
    process.exit(1);
  }
}

fixAdmin();
