import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const MONGO_URI = "mongodb://localhost:27017/classroom_utilization";
    
    // Connection options for better reliability
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    };
    
    const conn = await mongoose.connect(MONGO_URI, options);
    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    console.log(`✓ Database: ${conn.connection.name}`);
    
    // Set up connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✓ MongoDB reconnected');
    });
    
    return conn;
  } catch (error) {
    console.error(`⚠️  MongoDB Connection Error: ${error.message}`);
    console.error(`⚠️  Server will continue running, but database operations will fail.`);
    console.error(`⚠️  Please ensure MongoDB is running on localhost:27017`);
    // Don't exit - allow server to start even without MongoDB
    // This prevents proxy errors when backend server isn't running
    throw error; // Re-throw so server.js can handle it
  }
};

export default connectDB;
