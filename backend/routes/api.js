import express from 'express';
import * as apiController from '../controllers/apiController.js';
import { controllerHandler } from "../middleware/controllerHandler.js";
import { authenticateToken, requireTeacher } from "../middleware/auth.js";
import { body } from "express-validator";
import { validateRequest } from "../middleware/authValidation.js";

const router = express.Router();

// POST /api/attendance
// Logs class attendance for a user/teacher in a given classroom at a specific time.
router.post(
  '/attendance',
  authenticateToken,
  requireTeacher,
  [
    body('classroomId').isMongoId().withMessage('Valid classroom ID is required'),
    body('status').isIn(['present', 'absent']).withMessage('Status must be present or absent')
  ],
  validateRequest,
  controllerHandler(apiController.logAttendance)
);

// GET /api/classrooms
// Returns current classroom statuses. Supports filtering via query parameters.
router.get(
  '/classrooms',
  authenticateToken,
  controllerHandler(apiController.getClassroomStatus)
);

export default router;
