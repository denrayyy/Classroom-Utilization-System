import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import classroomRoutes from "./routes/classrooms.js";
import reservationRoutes from "./routes/reservations.js";
import authRoutes from "./routes/auth.js";
import scheduleRoutes from "./routes/schedules.js";
import usageRoutes from "./routes/usage.js";
import reportRoutes from "./routes/reports.js";
import timeInRoutes from "./routes/timein.js";
import userRoutes from "./routes/users.js";
import instructorRoutes from "./routes/instructors.js";
import apiRoutes from "./server/routes/api.js";
import seedAdminIfMissing from "./utils/seedAdmin.js";
import { initializeDailyArchive } from "./utils/dailyArchive.js";

// Load environment variables
dotenv.config();

// Verify Google OAuth configuration is loaded
if (process.env.GOOGLE_CLIENT_ID) {
  const maskedId = process.env.GOOGLE_CLIENT_ID.substring(0, 20) + '...';
  console.log('✓ Google OAuth Client ID loaded:', maskedId);
} else {
  console.log('✗ GOOGLE_CLIENT_ID not configured in .env file');
}

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Just read values once - using hardcoded values for now
const MONGO_URI = "mongodb://localhost:27017/classroom_utilization";
const PORT = process.env.PORT || 5000;

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); 
app.use(express.static("public"));

// Serve uploaded files (profile photos, evidence photos)
app.use('/uploads', express.static(path.join(__dirname, "uploads")));

// Serve static files from the React app build directory
app.use(express.static(path.join(__dirname, "client/build")));

// Connect to MongoDB
connectDB().then(() => {
  // Ensure admin exists (runs once on startup)
  seedAdminIfMissing().catch((e) => console.error("Admin seed error:", e));
  
  // Initialize daily archive cron job after DB connection
  try {
    initializeDailyArchive();
  } catch (error) {
    console.error("Error initializing daily archive cron job:", error);
    // Don't crash the server if cron job fails to initialize
  }
}).catch((e) => {
  console.error("Database connection error:", e);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/timein", timeInRoutes);
app.use("/api/users", userRoutes);
app.use("/api/instructors", instructorRoutes);
// Example public endpoints (attendance log and classroom status)
app.use("/api", apiRoutes);

// API routes
app.get("/api", (req, res) => {
  res.json({
    message: "Classroom Utilization System API is running...",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      classrooms: "/api/classrooms",
      reservations: "/api/reservations",
      schedules: "/api/schedules",
      usage: "/api/usage",
      reports: "/api/reports",
      timein: "/api/timein",
      users: "/api/users",
      instructors: "/api/instructors",
    },
  });
});

// Serve favicon
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// Serve React app for all non-API routes (for client-side routing)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// ✅ Only one PORT declaration
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
