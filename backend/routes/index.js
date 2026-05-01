import express from "express";
import { attachWorldTimeOptional } from "../middleware/worldTime.js";

// Route imports
import authRoutes from "./auth.js";
import classroomRoutes from "./classrooms.js";
import scheduleRoutes from "./schedules.js";
import usageRoutes from "./usage.js";
import reportRoutes from "./reports.js";
import timeInRoutes from "./timein.js";
import userRoutes from "./users.js";
import instructorRoutes from "./instructors.js";
import holidayRoutes from "./holidays.js";
import activityLogsRoutes from "./activityLogs.js";
import systemSettingsRoutes from "./systemSettings.js";
import notificationRoutes from "./notifications.js";
import settingsRoutes from "./settings.js";

const router = express.Router();

// Attach optional world time to all requests
router.use(attachWorldTimeOptional);

// API info route
router.get("/", (_req, res) => {
  res.json({
    message: "Classroom Utilization System API is running...",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      classrooms: "/api/classrooms",
      schedules: "/api/schedules",
      usage: "/api/usage",
      reports: "/api/reports",
      timein: "/api/timein",
      users: "/api/users",
      instructors: "/api/instructors",
      holidays: "/api/holidays",
      "activity-logs": "/api/activity-logs",
      "system-settings": "/api/system-settings",
      settings: "/api/settings",
      notifications: "/api/notifications",
    },
  });
});

// Mount route modules
router.use("/auth", authRoutes);
router.use("/classrooms", classroomRoutes);
router.use("/schedules", scheduleRoutes);
router.use("/usage", usageRoutes);
router.use("/reports", reportRoutes);
router.use("/timein", timeInRoutes);
router.use("/users", userRoutes);
router.use("/instructors", instructorRoutes);
router.use("/holidays", holidayRoutes);
router.use("/activity-logs", activityLogsRoutes);
router.use("/system-settings", systemSettingsRoutes);
router.use("/settings", settingsRoutes);
router.use("/notifications", notificationRoutes);

export default router;