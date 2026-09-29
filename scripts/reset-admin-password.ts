import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { User } from "../src/models/User";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  console.error("Please define MONGODB_URI in .env.local");
  process.exit(1);
}

// "Break glass" recovery for when every admin is locked out and there's no
// one left who could use the in-app admin-to-admin reset tool. Requires
// direct server/deploy access to run — that's the point: it's a deliberately
// higher-friction path than a button in the UI, reserved for the worst case.
function generateTempPassword(): string {
  return crypto.randomBytes(8).toString("base64url").slice(0, 10);
}

async function resetAdminPassword() {
  const identifier = process.argv[2];

  if (!identifier) {
    console.error("Usage: npx tsx scripts/reset-admin-password.ts <barberCode-or-email>");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected!");

    const searchTerm = identifier.toLowerCase();
    const admin = await User.findOne({
      role: "ADMIN",
      $or: [{ barberCode: searchTerm }, { email: searchTerm }],
    });

    if (!admin) {
      console.error(`No admin account found matching "${identifier}".`);
      process.exit(1);
    }

    const tempPassword = generateTempPassword();
    admin.passwordHash = await bcrypt.hash(tempPassword, 10);
    // Invalidate any existing session for this account too.
    admin.tokenVersion = (admin.tokenVersion || 0) + 1;
    await admin.save();

    console.log("\n✅ Admin password reset successfully!");
    console.log("-----------------------------------------");
    console.log(`Admin:        ${admin.name} (${admin.barberCode})`);
    console.log(`New password: ${tempPassword}`);
    console.log("-----------------------------------------");
    console.log("Log in and change this password as soon as possible.\n");

    process.exit(0);
  } catch (error) {
    console.error("Error resetting admin password:", error);
    process.exit(1);
  }
}

resetAdminPassword();
