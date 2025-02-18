const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // Set timeout to 30 seconds
    });
    console.log("MONGO DB CONNECTED");
  } catch (error) {
    console.error("DB connection failed:", error.message); // Log error message
    console.error("Detailed Error:", error); // Log full error object
    process.exit(1); // Exit process on failure
  }
};

module.exports = connectDB;
