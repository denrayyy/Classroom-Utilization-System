import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import {
  getReportHeaderSettings,
  updateReportHeaderSettings,
} from "../controllers/systemSettingsController.js";

const router = express.Router();

router.get(
  "/report-header",
  authenticateToken,
  controllerHandler(getReportHeaderSettings),
);

router.put(
  "/report-header",
  authenticateToken,
  requireAdmin,
  controllerHandler(updateReportHeaderSettings),
);

export default router;
