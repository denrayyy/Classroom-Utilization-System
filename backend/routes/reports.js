import express from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import * as reportsController from "../controllers/reportsController.js";

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/reports — list with filters
router.get("/", authenticateToken, reportsController.list);

// GET /api/reports/timein/all — all time-in transactions (Admin)
router.get("/timein/all", authenticateToken, requireAdmin, reportsController.getTimeInAll);

// POST /api/reports/teacher — generate teacher report
router.post(
  "/teacher",
  authenticateToken,
  [
    body("startDate").isISO8601().withMessage("Valid start date is required"),
    body("endDate").isISO8601().withMessage("Valid end date is required"),
    body("title").optional().isString(),
  ],
  validate,
  reportsController.generateTeacher
);

// POST /api/reports/admin — generate admin utilization report
router.post(
  "/admin",
  authenticateToken,
  requireAdmin,
  [
    body("startDate").isISO8601().withMessage("Valid start date is required"),
    body("endDate").isISO8601().withMessage("Valid end date is required"),
    body("title").optional().isString(),
  ],
  validate,
  reportsController.generateAdmin
);

// POST /api/reports/weekly — generate weekly report
router.post(
  "/weekly",
  authenticateToken,
  [body("startDate").isISO8601().withMessage("Valid start date is required")],
  validate,
  reportsController.generateWeekly
);

// POST /api/reports/archive-daily — trigger daily archive (Admin)
router.post("/archive-daily", authenticateToken, requireAdmin, reportsController.archiveDaily);

// GET /api/reports/:id/export-pdf — export as PDF (before /:id)
router.get("/:id/export-pdf", authenticateToken, reportsController.exportPdf);

// GET /api/reports/:id — get by id
router.get("/:id", authenticateToken, reportsController.getById);

// POST /api/reports/:id/share — share with users
router.post(
  "/:id/share",
  authenticateToken,
  [
    body("userIds").isArray().withMessage("User IDs array is required"),
    body("userIds.*").isMongoId().withMessage("Valid user ID is required"),
  ],
  validate,
  reportsController.share
);

// DELETE /api/reports/:id — delete report
router.delete("/:id", authenticateToken, reportsController.remove);

// PUT /api/reports/:id/comment — add/update comment (versioned)
router.put(
  "/:id/comment",
  authenticateToken,
  [body("comment").optional().isString()],
  validate,
  reportsController.updateComment
);

export default router;
