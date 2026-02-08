import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import * as reportsController from "../controllers/reportsController.js";
import {
  validateRequest,
  teacherReportValidation,
  adminReportValidation,
  weeklyReportValidation,
  shareReportValidation,
  commentReportValidation,
} from "../middleware/reportValidation.js";

const router = express.Router();

// GET /api/reports — list with filters
router.get(
  "/",
  authenticateToken,
  controllerHandler(reportsController.list)
);

// GET /api/reports/timein/all — Admin
router.get(
  "/timein/all",
  authenticateToken,
  requireAdmin,
  controllerHandler(reportsController.getTimeInAll)
);

// POST /api/reports/teacher
router.post(
  "/teacher",
  authenticateToken,
  teacherReportValidation,
  validateRequest,
  controllerHandler(reportsController.generateTeacher)
);

// POST /api/reports/admin — Admin
router.post(
  "/admin",
  authenticateToken,
  requireAdmin,
  adminReportValidation,
  validateRequest,
  controllerHandler(reportsController.generateAdmin)
);

// POST /api/reports/weekly
router.post(
  "/weekly",
  authenticateToken,
  weeklyReportValidation,
  validateRequest,
  controllerHandler(reportsController.generateWeekly)
);

// POST /api/reports/archive-daily — Admin
router.post(
  "/archive-daily",
  authenticateToken,
  requireAdmin,
  controllerHandler(reportsController.archiveDaily)
);

// GET /api/reports/timein/export-pdf
router.get(
  "/timein/export-pdf",
  authenticateToken,
  requireAdmin,
  controllerHandler(reportsController.exportTimeInPdf)
);

// GET /api/reports/:id
router.get(
  "/:id",
  authenticateToken,
  controllerHandler(reportsController.getById)
);

// POST /api/reports/:id/share
router.post(
  "/:id/share",
  authenticateToken,
  shareReportValidation,
  validateRequest,
  controllerHandler(reportsController.share)
);

// DELETE /api/reports/:id
router.delete(
  "/:id",
  authenticateToken,
  controllerHandler(reportsController.remove)
);

// PUT /api/reports/:id/comment
router.put(
  "/:id/comment",
  authenticateToken,
  commentReportValidation,
  validateRequest,
  controllerHandler(reportsController.updateComment)
);

export default router;
