import express from "express";
import { authenticateToken, requireTeacher, requireAdmin } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import { uploadEvidence } from "../middleware/timeinUpload.js";
import { multerErrorHandler } from "../middleware/multerErrorHandler.js";
import {
  createTimeinValidation,
  verifyTimeinValidation,
  validateRequest,
} from "../middleware/timeinValidation.js";
import { attachWorldTime } from "../middleware/worldTime.js";

import * as timeinController from "../controllers/timeinController.js";

const router = express.Router();

// ============================================================
// NEW ENDPOINTS (MUST be before /:id to avoid route conflicts)
// ============================================================

// ✅ GET /api/timein/monitoring/active — Get active time-ins for monitoring dashboard
router.get(
  "/monitoring/active",
  authenticateToken,
  controllerHandler(timeinController.getActiveTimeIns)
);

// ✅ GET /api/timein/availability/:classroomId — Check classroom availability
router.get(
  "/availability/:classroomId",
  authenticateToken,
  controllerHandler(timeinController.checkAvailability)
);

// ✅ GET /api/timein/check-holiday — Check if today is a holiday
router.get(
  "/check-holiday",
  authenticateToken,
  controllerHandler(timeinController.checkHoliday)
);

router.get(
  "/schedule-match/:classroomId",
  authenticateToken,
  attachWorldTime,
  controllerHandler(timeinController.getCurrentScheduleForClassroom)
);

// ✅ POST /api/timein/reset-old — Admin: Reset/archive old records
router.post(
  "/reset-old",
  authenticateToken,
  requireAdmin,
  controllerHandler(timeinController.resetOldTimeIns)
);

// ============================================================
// CORE TIME-IN/TIME-OUT ROUTES
// ============================================================

// POST /api/timein — create time-in with evidence
router.post(
  "/",
  authenticateToken,
  requireTeacher,
  attachWorldTime,
  uploadEvidence,
  multerErrorHandler,
  createTimeinValidation,
  validateRequest,
  controllerHandler(timeinController.create)
);

// PUT /api/timein/timeout — record time-out
router.put(
  "/timeout",
  authenticateToken,
  requireTeacher,
  attachWorldTime,
  controllerHandler(timeinController.timeout)
);

// ============================================================
// LIST & EXPORT
// ============================================================

// GET /api/timein — list with filters
router.get(
  "/",
  authenticateToken,
  controllerHandler(timeinController.list)
);

// GET /api/timein/export/pdf — Admin: Export PDF report
router.get(
  "/export/pdf",
  authenticateToken,
  requireAdmin,
  controllerHandler(timeinController.exportPdf)
);

// ============================================================
// EVIDENCE
// ============================================================

// GET /api/timein/evidence/:filename — Serve evidence file
router.get(
  "/evidence/:filename",
  authenticateToken,
  controllerHandler(timeinController.getEvidence)
);

// ============================================================
// SINGLE RECORD OPERATIONS (must be after named routes)
// ============================================================

// GET /api/timein/:id — Get single record
router.get(
  "/:id",
  authenticateToken,
  controllerHandler(timeinController.getById)
);

// PUT /api/timein/:id/verify — Admin: Verify/reject record
router.put(
  "/:id/verify",
  authenticateToken,
  requireAdmin,
  attachWorldTime,
  verifyTimeinValidation,
  validateRequest,
  controllerHandler(timeinController.verify)
);

// PUT /api/timein/:id/archive — Admin: Archive record
router.put(
  "/:id/archive",
  authenticateToken,
  requireAdmin,
  controllerHandler(timeinController.archive)
);

// PUT /api/timein/:id/unarchive — Admin: Unarchive record
router.put(
  "/:id/unarchive",
  authenticateToken,
  requireAdmin,
  controllerHandler(timeinController.unarchive)
);

// DELETE /api/timein/:id — Admin: Delete archived record
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  controllerHandler(timeinController.remove)
);

export default router;
