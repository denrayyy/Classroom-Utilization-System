import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import * as usageController from "../controllers/usageController.js";

const router = express.Router();

// GET /api/usage - Get classroom usage data
router.get("/", authenticateToken, usageController.getUsage);

// GET /api/usage/daily - Get daily usage statistics (must come before /:id)
router.get("/daily", authenticateToken, usageController.getDailyUsage);

// GET /api/usage/:id - Get specific usage record
router.get("/:id", authenticateToken, usageController.getUsageById);

// POST /api/usage - Create classroom usage record
router.post("/", authenticateToken, usageController.createUsage);

// PUT /api/usage/:classroomId - Update usage record
router.put("/:classroomId", authenticateToken, usageController.updateUsage);

// DELETE /api/usage/:classroomId - Delete usage record
router.delete("/:classroomId", authenticateToken, usageController.deleteUsage);

export default router;