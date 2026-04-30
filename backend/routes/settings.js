import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import {
  getNoClassReasons,
  addNoClassReason,
  removeNoClassReason,
} from "../controllers/systemSettingsController.js";

const router = express.Router();

// GET /api/settings/no-class-reasons — returns the array
router.get(
  "/no-class-reasons",
  authenticateToken,
  controllerHandler(getNoClassReasons),
);

// POST /api/settings/no-class-reasons — adds a new reason { reason: "string" }
router.post(
  "/no-class-reasons",
  authenticateToken,
  requireAdmin,
  controllerHandler(addNoClassReason),
);

// DELETE /api/settings/no-class-reasons/:index — removes by index
router.delete(
  "/no-class-reasons/:index",
  authenticateToken,
  requireAdmin,
  controllerHandler(removeNoClassReason),
);

export default router;

