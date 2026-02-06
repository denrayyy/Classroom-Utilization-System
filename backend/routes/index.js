/**
 * Central API router: all /api routes are mounted here and run through shared middleware.
 * - World time is attached via middleware so controllers use req.worldTime (no direct worldTimeAPI in controllers).
 */

import express from "express";
import { attachWorldTimeOptional } from "../middleware/worldTime.js";
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

// World time: attached for all API requests; controllers use req.worldTime
router.use(attachWorldTimeOptional);

// GET /api — API info (no auth)
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

// Mount all route modules (each defines its own auth/validation middleware)
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
