import express from "express";
import * as classroomController from "../controllers/classroomController.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import { validateRequest, createClassroomValidation } from "../middleware/classroomValidation.js";

const router = express.Router();

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
  controllerHandler(classroomController.createClassroom)
);

// PUT /api/classrooms/:id — update classroom
router.put(
  "/:id",
  controllerHandler(classroomController.updateClassroom)
);

// DELETE /api/classrooms/:id — delete classroom
router.delete(
  "/:id",
  controllerHandler(classroomController.deleteClassroom)
);

export default router;
