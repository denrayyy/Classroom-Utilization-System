import express from "express";
import Classroom from "../models/Classroom.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

// @route   GET /api/classrooms
// @desc    Get all classrooms
// @access  Public
router.get("/", async (req, res) => {
  try {
    const classrooms = await Classroom.find().lean();
    res.json(classrooms);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

// @route   GET /api/classrooms/:id
// @desc    Get classroom by ID
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const classroom = await Classroom.findById(req.params.id).lean();
    if (!classroom) {
      return res.status(404).json({ msg: "Classroom not found" });
    }
    res.json(classroom);
  } catch (error) {
    console.error(error.message);
    if (error.kind === "ObjectId") {
      return res.status(404).json({ msg: "Classroom not found" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   POST /api/classrooms
// @desc    Create a new classroom
// @access  Public
router.post("/", [
  body("name").notEmpty().withMessage("Name is required"),
  body("location").notEmpty().withMessage("Location is required")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, capacity, location, equipment, description } = req.body;

    const classroom = new Classroom({
      name,
      capacity,
      location,
      equipment: equipment || [],
      description
    });

    await classroom.save();
    res.json(classroom);
  } catch (error) {
    console.error(error.message);
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Classroom with this name already exists" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   PUT /api/classrooms/:id
// @desc    Update classroom
// @access  Public
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      capacity,
      location,
      equipment,
      description,
      isAvailable,
      schedules
    } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (capacity !== undefined) updateFields.capacity = capacity;
    if (location !== undefined) updateFields.location = location;
    if (equipment !== undefined) updateFields.equipment = equipment;
    if (description !== undefined) updateFields.description = description;
    if (isAvailable !== undefined) updateFields.isAvailable = isAvailable;
    if (schedules !== undefined) updateFields.schedules = schedules;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ msg: "No fields provided to update" });
    }

    const updatedClassroom = await Classroom.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedClassroom) {
      return res.status(404).json({ msg: "Classroom not found" });
    }

    res.json(updatedClassroom);
  } catch (error) {
    console.error(error.message);
    if (error.code === 11000) {
      return res.status(400).json({ msg: "Classroom with this name already exists" });
    }
    res.status(500).send("Server Error");
  }
});

// @route   DELETE /api/classrooms/:id
// @desc    Delete classroom
// @access  Public
router.delete("/:id", async (req, res) => {
  try {
    const deletedClassroom = await Classroom.findByIdAndDelete(req.params.id).lean();

    if (!deletedClassroom) {
      return res.status(404).json({ msg: "Classroom not found" });
    }

    res.json({ msg: "Classroom deleted successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

export default router;
