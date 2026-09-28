const mongoose = require("mongoose");
const { Schema, Document } = mongoose;
const bcrypt = require("bcryptjs");

async function checkAdmin() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/barber");
  console.log("Connected to DB");

  const UserSchema = new Schema({}, { strict: false });
  const User = mongoose.models.User || mongoose.model("User", UserSchema);

  const admins = await User.find({ role: "ADMIN" });
  if (admins.length > 0) {
    console.log(`Found ${admins.length} admins.`);
    console.log(`Admin email: ${admins[0].email}`);
    
    // Reset password to "admin123" for the first admin to give to the user
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("admin123", salt);
    await User.findByIdAndUpdate(admins[0]._id, { passwordHash });
    
    console.log("Password reset to: admin123");
  } else {
    console.log("No admins found. Creating one...");
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash("admin123", salt);
    
    const newAdmin = new User({
      name: "Super Admin",
      email: "admin@barber.com",
      passwordHash,
      role: "ADMIN",
      slug: "super-admin",
    });
    
    await newAdmin.save();
    console.log("Created new admin: admin@barber.com / admin123");
  }

  process.exit(0);
}

checkAdmin().catch(console.error);
