import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { logActivity } from "../middleware/activityLogger.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import * as scheduleController from "../controllers/scheduleController.js";

const router = express.Router();

// GET /api/schedules - Get all schedules
router.get(
  "/",
  authenticateToken,
  controllerHandler(scheduleController.getSchedules)
);

// POST /api/schedules - Create a new schedule
router.post(
  "/",
  authenticateToken,
  logActivity,
  controllerHandler(scheduleController.createSchedule)
);

// GET /api/schedules/:id - Get a specific schedule
router.get(
  "/:id",
  authenticateToken,
  controllerHandler(scheduleController.getScheduleById)
);

// PUT /api/schedules/:id - Update a schedule
router.put(
  "/:id",
  authenticateToken,
  logActivity,
  controllerHandler(scheduleController.updateSchedule)
);

// DELETE /api/schedules/:id - Delete a schedule
router.delete(
  "/:id",
  authenticateToken,
  logActivity,
  controllerHandler(scheduleController.deleteSchedule)
);

export default router;
