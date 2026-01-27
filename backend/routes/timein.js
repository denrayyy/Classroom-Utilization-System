import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireTeacher, requireAdmin } from "../middleware/auth.js";
import * as timeinController from "../controllers/timeinController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer config for evidence uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "../uploads/evidence"));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `evidence-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// POST /api/timein — create time-in with evidence
router.post(
  "/",
  authenticateToken,
  requireTeacher,
  upload.single("evidence"),
  handleMulterError,
  [
    body("classroom").isMongoId().withMessage("Valid classroom ID is required"),
    body("instructorName").notEmpty().withMessage("Instructor name is required"),
    body("remarks").optional().isString(),
  ],
  validate,
  timeinController.create
);

// PUT /api/timein/timeout — record time-out
router.put("/timeout", authenticateToken, requireTeacher, timeinController.timeout);

// GET /api/timein — list with filters
router.get("/", authenticateToken, timeinController.list);

// GET /api/timein/evidence/:filename — serve evidence image (before /:id)
router.get("/evidence/:filename", authenticateToken, timeinController.getEvidence);

// GET /api/timein/export/pdf — PDF export (Admin)
router.get("/export/pdf", authenticateToken, requireAdmin, timeinController.exportPdf);

// PUT /api/timein/:id/archive — archive (Admin)
router.put("/:id/archive", authenticateToken, timeinController.archive);

// PUT /api/timein/:id/unarchive — unarchive (Admin)
router.put("/:id/unarchive", authenticateToken, timeinController.unarchive);

// DELETE /api/timein/:id — delete archived (Admin)
router.delete("/:id", authenticateToken, timeinController.remove);

// GET /api/timein/:id — get by id
router.get("/:id", authenticateToken, timeinController.getById);

// PUT /api/timein/:id/verify — verify/reject (Admin, versioned)
router.put(
  "/:id/verify",
  authenticateToken,
  [
    body("status").isIn(["verified", "rejected"]).withMessage("Status must be verified or rejected"),
    body("remarks").optional().isString(),
  ],
  validate,
  timeinController.verify
);

export default router;
