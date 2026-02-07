import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import * as usageController from "../controllers/usageController.js";

const router = express.Router();

// GET /api/usage - Get classroom usage data
router.get(
  "/",
  authenticateToken,
  controllerHandler(usageController.getUsage)
);

// GET /api/usage/daily - Get daily usage statistics
router.get(
  "/daily",
  authenticateToken,
  controllerHandler(usageController.getDailyUsage)
);

// GET /api/usage/:id - Get specific usage record
router.get(
  "/:id",
  authenticateToken,
  controllerHandler(usageController.getUsageById)
);

// POST /api/usage - Create classroom usage record
router.post(
  "/",
  authenticateToken,
  controllerHandler(usageController.createUsage)
);

// PUT /api/usage/:classroomId - Update usage record
router.put(
  "/:classroomId",
  authenticateToken,
  controllerHandler(usageController.updateUsage)
);

// DELETE /api/usage/:classroomId - Delete usage record
router.delete(
  "/:classroomId",
  authenticateToken,
  controllerHandler(usageController.deleteUsage)
);

export default router;
