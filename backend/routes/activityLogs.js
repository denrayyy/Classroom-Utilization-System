import express from "express";
import { controllerHandler } from "../middleware/controllerHandler.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import * as activityLogsController from "../controllers/activityLogsController.js";

const router = express.Router();

// GET /api/activity-logs — list all activity logs with pagination and filters (admin only)
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  controllerHandler(activityLogsController.getActivityLogs)
);

// GET /api/activity-logs/entity-types — get all unique entity types for filter dropdown (admin only)
router.get(
  "/entity-types",
  authenticateToken,
  requireAdmin,
  controllerHandler(activityLogsController.getEntityTypes)
);

// GET /api/activity-logs/:id — get a single activity log by ID (admin only)
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  controllerHandler(activityLogsController.getActivityLogById)
);

export default router;