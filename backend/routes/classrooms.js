import express from "express";
import { body, validationResult } from "express-validator";
import * as classroomController from "../controllers/classroomController.js";

const router = express.Router();

// Validation middleware helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// @route   GET /api/classrooms
// @desc    Get all classrooms with optional filtering
// @access  Public
// @query   computerLabOnly: boolean - Filter to show only computer labs
// @query   excludeComputerLabs: boolean - Filter to exclude computer labs
router.get("/", classroomController.getClassrooms);

// @route   GET /api/classrooms/:id
// @desc    Get classroom by ID
// @access  Public
router.get("/:id", classroomController.getClassroomById);

// @route   POST /api/classrooms
// @desc    Create a new classroom
// @access  Public
router.post("/", [
  body("name").notEmpty().withMessage("Name is required"),
  body("location").notEmpty().withMessage("Location is required")
], validate, classroomController.createClassroom);

// @route   PUT /api/classrooms/:id
// @desc    Update classroom
// @access  Public
router.put("/:id", classroomController.updateClassroom);

// @route   DELETE /api/classrooms/:id
// @desc    Delete classroom
// @access  Public
router.delete("/:id", classroomController.deleteClassroom);

export default router;
