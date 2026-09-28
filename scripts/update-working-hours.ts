import mongoose from "mongoose";
import dotenv from "dotenv";

// Load env vars
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI as string;

const run = async () => {
  if (!MONGODB_URI) {
    console.error("No MONGODB_URI found");
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  if (!db) {
    console.error("Database connection failed");
    process.exit(1);
  }

  const users = await db.collection("users").find({}).toArray();

  for (const user of users) {
    if (user.workingHours && user.workingHours.length > 0) {
      let changed = false;
      const newWorkingHours = user.workingHours.map((wh: any) => {
        if (wh.startTime === "10:00" && wh.endTime === "20:00") {
          changed = true;
          return { ...wh, startTime: "10:00 AM", endTime: "8:00 PM" };
        }
        return wh;
      });

      if (changed) {
        await db.collection("users").updateOne(
          { _id: user._id },
          { $set: { workingHours: newWorkingHours } }
        );
        console.log(`Updated user: ${user.email}`);
      }
    }
  }

  console.log("Done");
  process.exit(0);
};

run().catch(console.error);
