// seedAdmin.js
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("./models/User");

(async () => {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    const username = "admin";
    const password = "admin123";

    let admin = await User.findOne({ username });
    if (admin) {
      console.log("⚠️ Admin already exists. Updating password...");
      admin.password = password; // triggers pre-save hook -> hashes automatically
      await admin.save();
      console.log("✅ Admin password updated successfully!");
    } else {
      console.log("🆕 Creating new admin user...");
      admin = await User.create({ username, password, role: "admin" });
      console.log("✅ Admin created successfully!");
    }

    await mongoose.connection.close();
    console.log("🔒 Connection closed.");
  } catch (err) {
    console.error("❌ Error seeding admin:", err.message);
    process.exit(1);
  }
})();
