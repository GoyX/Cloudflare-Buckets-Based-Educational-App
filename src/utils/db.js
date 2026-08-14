const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    isConnected = true;
    console.log("Connected to DB . .");
    return conn;
  } catch (error) {
    isConnected = false;
    console.error("MongoDB connection error:", error);
    return null;
  }
};

module.exports = connectDB;
