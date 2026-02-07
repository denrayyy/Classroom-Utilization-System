import express from "express";
import { attachWorldTimeOptional } from "../middleware/worldTime.js";

// Route imports
import authRoutes from "./auth.js";
import classroomRoutes from "./classrooms.js";
import reservationRoutes from "./reservations.js";
import scheduleRoutes from "./schedules.js";
import usageRoutes from "./usage.js";
import reportRoutes from "./reports.js";
import timeInRoutes from "./timein.js";
import userRoutes from "./users.js";
import instructorRoutes from "./instructors.js";
import apiRoutes from "./api.js";
import activityLogsRoutes from "./activityLogs.js";

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

// Mount route modules
router.use("/auth", authRoutes);
router.use("/classrooms", classroomRoutes);
router.use("/reservations", reservationRoutes);
router.use("/schedules", scheduleRoutes);
router.use("/usage", usageRoutes);
router.use("/reports", reportRoutes);
router.use("/timein", timeInRoutes);
router.use("/users", userRoutes);
router.use("/instructors", instructorRoutes);
router.use("/activity-logs", activityLogsRoutes);
router.use("/", apiRoutes);

export default router;
