import express from "express";
import { controllerHandler } from "../middleware/controllerHandler.js";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import * as activityLogsController from "../controllers/activityLogsController.js";

const router = express.Router();

// GET /api/activity-logs — list all activity logs (admin only)
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  controllerHandler(activityLogsController.getActivityLogs)
);

export default router;
