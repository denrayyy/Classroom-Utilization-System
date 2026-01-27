import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { logActivity } from "../middleware/activityLogger.js";
import * as scheduleController from "../controllers/scheduleController.js";

const router = express.Router();

// GET /api/schedules - Get all schedules with pagination, search, filter, and sort
router.get("/", authenticateToken, scheduleController.getSchedules);

// POST /api/schedules - Create a new schedule
router.post("/", authenticateToken, logActivity, scheduleController.createSchedule);

// GET /api/schedules/:id - Get a specific schedule
router.get("/:id", authenticateToken, scheduleController.getScheduleById);

// PUT /api/schedules/:id - Update a schedule
router.put("/:id", authenticateToken, logActivity, scheduleController.updateSchedule);

// DELETE /api/schedules/:id - Delete a schedule
router.delete("/:id", authenticateToken, logActivity, scheduleController.deleteSchedule);

export default router;
