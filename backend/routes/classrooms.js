import express from "express";
import * as classroomController from "../controllers/classroomController.js";
import * as pdfUploadController from "../controllers/pdfUploadController.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import { validateRequest, createClassroomValidation } from "../middleware/classroomValidation.js";
import { logActivity } from "../middleware/activityLogger.js";
import { authenticateToken } from "../middleware/auth.js";


const router = express.Router();

// ==========================================
// PDF SCHEDULE UPLOAD ROUTES
// ==========================================
// IMPORTANT: These must come BEFORE the /:id routes to avoid conflicts

// POST /api/classrooms/upload-schedule — Upload and parse PDF schedule
router.post(
  "/upload-schedule",
  authenticateToken,
  pdfUploadController.upload.single('pdf'),
  controllerHandler(pdfUploadController.uploadSchedule)
);

// POST /api/classrooms/bulk-import-schedules — Import extracted schedules to database
router.post(
  "/bulk-import-schedules",
  authenticateToken,
  logActivity,
  controllerHandler(pdfUploadController.bulkImportSchedules)
);

// ==========================================
// REGULAR CLASSROOM ROUTES
// ==========================================

// GET /api/classrooms — list all classrooms with optional filters
router.get(
  "/",
  controllerHandler(classroomController.getClassrooms)
);

// GET /api/classrooms/:id — get classroom by ID
router.get(
  "/:id",
  controllerHandler(classroomController.getClassroomById)
);

// POST /api/classrooms — create new classroom
router.post(
  "/",
  createClassroomValidation,
  validateRequest,
  authenticateToken,
  logActivity,
  controllerHandler(classroomController.createClassroom)
  
);

// PUT /api/classrooms/:id — update classroom
router.put(
  "/:id",
   authenticateToken, 
   logActivity,
  controllerHandler(classroomController.updateClassroom),
  
);

// PATCH /api/classrooms/:id/archive — archive classroom (soft delete)
router.patch(
  "/:id/archive",
  authenticateToken,
  logActivity,
  controllerHandler(classroomController.archiveClassroom)
);

// PATCH /api/classrooms/:id/restore — unarchive classroom
router.patch(
  "/:id/restore",
  authenticateToken,
  logActivity,
  controllerHandler(classroomController.restoreClassroom)
);

// DELETE /api/classrooms/:id — delete classroom
// router.delete(
//   "/:id",
//   authenticateToken,
//   logActivity,
//   controllerHandler(classroomController.deleteClassroom),
  
// );

export default router;