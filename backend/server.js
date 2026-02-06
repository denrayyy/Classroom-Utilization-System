import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import apiRoutes from "./routes/index.js";
import seedAdminIfMissing from "./utils/seedAdmin.js";
import { initializeDailyArchive } from "./utils/dailyArchive.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Verify Google OAuth configuration is loaded
if (process.env.GOOGLE_CLIENT_ID) {
  const maskedId = process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...';
  console.log('✓ Google OAuth Client ID loaded:', maskedId);
} else {
  console.log('✗ GOOGLE_CLIENT_ID not configured in .env file');
}



// Get configuration from environment variables
const PORT = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Serve uploaded files (profile photos, evidence photos)
app.use('/uploads', express.static(path.join(__dirname, "uploads")));

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, "../frontend/build")));

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    console.log("✓ MongoDB connection established successfully");
    // Ensure admin exists (runs once on startup)
    seedAdminIfMissing().catch((e) => console.error("Admin seed error:", e));

    // Initialize daily archive cron job after DB connection
    try {
      initializeDailyArchive();
    } catch (error) {
      console.error("Error initializing daily archive cron job:", error);
      // Don't crash the server if cron job fails to initialize
    }
  })
  .catch((e) => {
    console.error("⚠️  Database connection error:", e.message);
    console.error("⚠️  Server will start but database operations may fail");
  });

// All /api routes: mounted on central router (world-time and other middleware applied there)
app.use("/api", apiRoutes);

// Serve favicon
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// Serve React app for all non-API routes (for client-side routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

// Error handling middleware (must be last)
app.use(errorHandler);

// ✅ Only one PORT declaration
app.listen(PORT, () => {
  console.log(`\n✓ Server running on http://localhost:${PORT}`);
  console.log(`✓ API available at http://localhost:${PORT}/api\n`);
});
