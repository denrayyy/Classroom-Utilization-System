import express from "express";
import Instructor from "../models/Instructor.js";
import { body, validationResult } from "express-validator";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// @route   GET /api/instructors
// @desc    Get all instructors
// @access  Public (for time-in form)
router.get("/", async (req, res) => {
  try {
    const instructors = await Instructor.find().sort({ name: 1 });
    res.json(instructors);
  } catch (error) {
    console.error("Error fetching instructors:", error);
    res.status(500).json({ message: "Server error while fetching instructors" });
  }
});

// @route   POST /api/instructors
// @desc    Create a new instructor (admin only)
// @access  Private/Admin
router.post("/", authenticateToken, requireAdmin, [
  body("name").notEmpty().trim().withMessage("Instructor name is required")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name } = req.body;

    // Check if instructor already exists
    const existingInstructor = await Instructor.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } // Case-insensitive check
    });

    if (existingInstructor) {
      return res.status(400).json({ 
        message: "Instructor with this name already exists" 
      });
    }

    const instructor = new Instructor({ name: name.trim() });
    await instructor.save();

    res.status(201).json({
      message: "Instructor added successfully",
      instructor: {
        _id: instructor._id,
        name: instructor.name
      }
    });
  } catch (error) {
    console.error("Error creating instructor:", error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: "Instructor with this name already exists" 
      });
    }
    res.status(500).json({ message: "Server error while creating instructor" });
  }
});

// @route   DELETE /api/instructors/:id
// @desc    Delete an instructor (admin only)
// @access  Private/Admin
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const instructor = await Instructor.findByIdAndDelete(req.params.id);
    
    if (!instructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    res.json({ message: "Instructor deleted successfully" });
  } catch (error) {
    console.error("Error deleting instructor:", error);
    res.status(500).json({ message: "Server error while deleting instructor" });
  }
});

export default router;

