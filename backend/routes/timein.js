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

import * as timeinController from "../controllers/timeinController.js";

const router = express.Router();

// POST /api/timein — create time-in with evidence
router.post(
  "/",
  authenticateToken,
  requireTeacher,
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
  controllerHandler(timeinController.timeout)
);

// GET /api/timein — list with filters
router.get(
  "/",
  authenticateToken,
  controllerHandler(timeinController.list)
);

// GET /api/timein/evidence/:filename
router.get(
  "/evidence/:filename",
  authenticateToken,
  controllerHandler(timeinController.getEvidence)
);

// GET /api/timein/export/pdf — Admin
router.get(
  "/export/pdf",
  authenticateToken,
  requireAdmin,
  controllerHandler(timeinController.exportPdf)
);

// PUT /api/timein/:id/archive — Admin
router.put(
  "/:id/archive",
  authenticateToken,
  requireAdmin,
  controllerHandler(timeinController.archive)
);

// PUT /api/timein/:id/unarchive — Admin
router.put(
  "/:id/unarchive",
  authenticateToken,
  requireAdmin,
  controllerHandler(timeinController.unarchive)
);

// DELETE /api/timein/:id — Admin
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  controllerHandler(timeinController.remove)
);

// GET /api/timein/:id
router.get(
  "/:id",
  authenticateToken,
  controllerHandler(timeinController.getById)
);

// PUT /api/timein/:id/verify — Admin
router.put(
  "/:id/verify",
  authenticateToken,
  requireAdmin,
  verifyTimeinValidation,
  validateRequest,
  controllerHandler(timeinController.verify)
);

export default router;
