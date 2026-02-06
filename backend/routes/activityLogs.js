import express from "express";
import { getActivityLogs } from "../controllers/activityLogsController.js";

const router = express.Router();

// GET /api/activity-logs
router.get("/", getActivityLogs);

export default router;
