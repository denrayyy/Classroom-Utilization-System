import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import * as instructorController from "../controllers/instructorController.js";
import { createInstructorValidation, validateRequest } from "../middleware/instructorValidation.js";

const router = express.Router();

// GET /api/instructors — Public (for time-in form)
router.get(
  "/",
  controllerHandler(instructorController.getInstructors)
);

// POST /api/instructors — Admin only
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  createInstructorValidation,
  validateRequest,
  controllerHandler(instructorController.createInstructor)
);

// DELETE /api/instructors/:id — Admin only
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  controllerHandler(instructorController.deleteInstructor)
);

// PUT /api/instructors/:id — Admin only
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  controllerHandler(instructorController.updateInstructor)
);

export default router;
