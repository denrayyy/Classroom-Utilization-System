import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const MONGO_URI = "mongodb://localhost:27017/classroom_utilization";
    const conn = await mongoose.connect(MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;
