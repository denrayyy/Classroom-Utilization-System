import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import apiRoutes from "./routes/index.js";
import Holiday from "./models/Holiday.js";
import seedAdminIfMissing from "./utils/seedAdmin.js";
import { initializeDailyArchive } from "./utils/dailyArchive.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, ".env") });

console.log("Loaded JWT_SECRET:", process.env.JWT_SECRET ? "✓" : "✗");

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

const seedNextYearHolidays = async () => {
  try {
    const nextYear = new Date().getFullYear() + 1;
    const existingCount = await Holiday.countDocuments({ year: nextYear });

    if (existingCount > 0) {
      console.log(`✅ Holidays for ${nextYear} already exist (${existingCount} found)`);
      return;
    }

    const holidays = [
      { name: "New Year's Day", date: new Date(`${nextYear}-01-01`), type: "regular", description: "Regular holiday", isActive: true, year: nextYear, isRecurring: true },
      { name: "EDSA People Power Anniversary", date: new Date(`${nextYear}-02-25`), type: "special", description: "Special non-working day", isActive: true, year: nextYear, isRecurring: true },
      { name: "Araw ng Kagitingan", date: new Date(`${nextYear}-04-09`), type: "regular", description: "Day of Valor", isActive: true, year: nextYear, isRecurring: true },
      { name: "Labor Day", date: new Date(`${nextYear}-05-01`), type: "regular", description: "Regular holiday", isActive: true, year: nextYear, isRecurring: true },
      { name: "Independence Day", date: new Date(`${nextYear}-06-12`), type: "regular", description: "Regular holiday", isActive: true, year: nextYear, isRecurring: true },
      { name: "Ninoy Aquino Day", date: new Date(`${nextYear}-08-21`), type: "special", description: "Special non-working day", isActive: true, year: nextYear, isRecurring: true },
      { name: "National Heroes Day", date: new Date(`${nextYear}-08-25`), type: "regular", description: "Regular holiday", isActive: true, year: nextYear, isRecurring: true },
      { name: "All Saints' Day", date: new Date(`${nextYear}-11-01`), type: "special", description: "Special non-working day", isActive: true, year: nextYear, isRecurring: true },
      { name: "Bonifacio Day", date: new Date(`${nextYear}-11-30`), type: "regular", description: "Regular holiday", isActive: true, year: nextYear, isRecurring: true },
      { name: "Feast of the Immaculate Conception", date: new Date(`${nextYear}-12-08`), type: "special", description: "Special non-working day", isActive: true, year: nextYear, isRecurring: true },
      { name: "Christmas Day", date: new Date(`${nextYear}-12-25`), type: "regular", description: "Regular holiday", isActive: true, year: nextYear, isRecurring: true },
      { name: "Rizal Day", date: new Date(`${nextYear}-12-30`), type: "regular", description: "Regular holiday", isActive: true, year: nextYear, isRecurring: true },
      { name: "Last Day of the Year", date: new Date(`${nextYear}-12-31`), type: "special", description: "Special non-working day", isActive: true, year: nextYear, isRecurring: true },
    ];

    await Holiday.insertMany(holidays);
    console.log(`✅ Auto-seeded ${holidays.length} holidays for ${nextYear}`);
  } catch (error) {
    console.error("⚠️ Failed to auto-seed holidays:", error.message);
  }
};

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
  .then(async () => {
    console.log("✓ MongoDB connection established successfully");
    // Ensure admin exists (runs once on startup)
    try {
      await seedAdminIfMissing();
    } catch (e) {
      console.error("Admin seed error:", e);
    }

    await seedNextYearHolidays();

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
