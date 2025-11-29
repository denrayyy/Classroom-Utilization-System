import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/classroom_utilization";
    await mongoose.connect(mongoURI);
    console.log("✓ Connected to MongoDB");
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error);
    process.exit(1);
  }
};

const removeVersionField = async () => {
  try {
    const db = mongoose.connection.db;
    const usersCollection = db.collection("users");

    // Remove __v field from all documents
    const result = await usersCollection.updateMany(
      {},
      { $unset: { __v: "" } }
    );
    console.log(`✓ Removed __v field from ${result.modifiedCount} documents`);

    // Verify the field is removed
    const sampleDoc = await usersCollection.findOne({});
    console.log("\n✓ Sample document after cleanup:");
    console.log(JSON.stringify(sampleDoc, null, 2));

  } catch (error) {
    console.error("✗ Error removing field:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\n✓ Disconnected from MongoDB");
  }
};

connectDB().then(() => removeVersionField());
