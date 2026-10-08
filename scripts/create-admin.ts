import mongoose from "mongoose";
import { User } from "../src/models/User";
import { hashPassword } from "../src/lib/password";
import { requireMongoUri } from "./env";

/**
 * Creates the FIRST admin account on a database.
 *
 *   ADMIN_CODE=owner ADMIN_PASSWORD='a-long-private-password' npx tsx scripts/create-admin.ts
 *
 * The login code and password come from the command line, never from this file, so nothing secret is stored in git.
 * The password is never printed. Change it after the first login (Admin → Settings → Change My Password).
 */
async function createAdmin() {
  // Login looks the code up in lower case, so store it that way (otherwise "Owner" could never log in).
  const adminCode = (process.env.ADMIN_CODE || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Administrator").trim();

  if (!adminCode || adminCode.length < 3) {
    console.error("Set ADMIN_CODE (at least 3 characters): the code the admin will log in with.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Set ADMIN_PASSWORD to a private password of at least 10 characters.");
    process.exit(1);
  }

  try {
    const uri = requireMongoUri();
    // Say which database this is about to change (host only, never the password), so a wrong target is obvious.
    console.log(`Database: ${new URL(uri).host}`);
    await mongoose.connect(uri);
    if (await User.findOne({ barberCode: adminCode })) {
      console.log(`An account with the code "${adminCode}" already exists. Nothing was changed.`);
      process.exit(0);
    }

    await User.create({
      name,
      barberCode: adminCode, // the login username
      slug: `${adminCode.toLowerCase().replace(/[^a-z0-9-]/g, "-")}-admin`, // admins have no public page, but the schema needs a unique slug
      passwordHash: await hashPassword(password),
      role: "ADMIN",
      bio: "System Administrator",
      workingHours: [],
    });

    console.log(`\n✅ Admin created. Log in at /login with the code "${adminCode}" and the password you supplied.`);
    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  }
}

createAdmin();
