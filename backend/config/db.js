import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/classroom_utilization";
    
    // Keep buffering enabled during connection attempt
    // Mongoose will buffer operations until connection is established
    mongoose.set('bufferCommands', true);
    
    // Connection options for better reliability
    const options = {
      serverSelectionTimeoutMS: 10000, // Timeout after 10s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 5, // Maintain at least 5 socket connections
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
      // Keep buffering enabled so operations can wait for reconnection
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✓ MongoDB reconnected');
    });
    
    return conn;
  } catch (error) {
    console.error(`⚠️  MongoDB Connection Error: ${error.message}`);
    console.error(`⚠️  Attempted to connect to: ${process.env.MONGO_URI || "mongodb://localhost:27017/classroom_utilization"}`);
    console.error(`⚠️  Server will continue running, but database operations will fail.`);
    console.error(`⚠️  Please ensure MongoDB is running and MONGO_URI is correct.`);
    
    // Keep buffering enabled so operations can queue until connection is restored
    // Don't exit - allow server to start even without MongoDB
    // This prevents proxy errors when backend server isn't running
    throw error; // Re-throw so server.js can handle it
  }
};

export default connectDB;
