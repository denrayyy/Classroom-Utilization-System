import express from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import * as instructorController from "../controllers/instructorController.js";

const router = express.Router();

// Validation middleware helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// @route   GET /api/instructors
// @desc    Get all instructors
// @access  Public (for time-in form)
router.get("/", instructorController.getInstructors);

// @route   POST /api/instructors
// @desc    Create a new instructor (admin only)
// @access  Private/Admin
router.post("/", authenticateToken, requireAdmin, [
  body("name").notEmpty().trim().withMessage("Instructor name is required")
], validate, instructorController.createInstructor);

// @route   DELETE /api/instructors/:id
// @desc    Delete an instructor (admin only)
// @access  Private/Admin
router.delete("/:id", authenticateToken, requireAdmin, instructorController.deleteInstructor);

// @route   PUT /api/instructors/:id
// @desc    Update instructor (archive/restore/unavailable status) (admin only)
// @access  Private/Admin
router.put("/:id", authenticateToken, requireAdmin, instructorController.updateInstructor);

export default router;

