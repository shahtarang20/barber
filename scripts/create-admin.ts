import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

async function createAdmin() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected!");

    const adminCode = "admin";
    const existingAdmin = await User.findOne({ barberCode: adminCode });

    if (existingAdmin) {
      console.log("Admin already exists!");
      process.exit(0);
    }

    console.log("Creating super admin...");
    const passwordHash = await bcrypt.hash("AdminSecret123!", 10);

    await User.create({
      name: "Super Admin",
      barberCode: adminCode, // The login username
      email: "admin@barbersaas.com",
      slug: "super-admin", // Admins don't have public pages, but schema requires it
      passwordHash,
      role: "ADMIN",
      bio: "System Administrator",
      workingHours: [],
    });

    console.log("\n✅ Admin Account Created Successfully!");
    console.log("-----------------------------------------");
    console.log("Login URL:    http://localhost:3000/login");
    console.log("Admin Code:   admin");
    console.log("Password:     AdminSecret123!");
    console.log("-----------------------------------------\n");

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  }
}

createAdmin();
