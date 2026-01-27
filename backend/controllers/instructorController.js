/**
 * Instructor Controller
 * Handles HTTP requests and responses for instructor operations
 */

import Instructor from "../models/Instructor.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";

/**
 * Get all instructors
 */
export const getInstructors = asyncHandler(async (req, res) => {
  const instructors = await Instructor.find().sort({ name: 1 });
  res.json(instructors);
});

/**
 * Create a new instructor
 */
export const createInstructor = asyncHandler(async (req, res) => {
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
});

/**
 * Update instructor
 */
export const updateInstructor = asyncHandler(async (req, res) => {
  const version = requireVersion(req.body.version);
  const { archived, name, unavailable, unavailableReason } = req.body;
  const updates = {};

  // Handle name update with duplicate check
  if (name !== undefined) {
    const existingInstructor = await Instructor.findOne({ 
      _id: { $ne: req.params.id },
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingInstructor) {
      return res.status(400).json({ 
        message: "Instructor with this name already exists" 
      });
    }
    updates.name = name.trim();
  }

  if (archived !== undefined) {
    updates.archived = archived;
  }

  if (unavailable !== undefined) {
    updates.unavailable = unavailable;
    if (unavailable && unavailableReason) {
      updates.unavailableReason = unavailableReason.trim();
    } else if (!unavailable) {
      updates.unavailableReason = null;
    }
  }

  const updateDoc = buildVersionedUpdateDoc(updates);

  const instructor = await runVersionedUpdate(
    Instructor,
    req.params.id,
    version,
    updateDoc
  );

  if (!instructor) {
    return respondWithConflict(res, "Instructor");
  }

  res.json({ 
    message: "Instructor updated successfully",
    instructor
  });
});

/**
 * Delete instructor
 */
export const deleteInstructor = asyncHandler(async (req, res) => {
  const instructor = await Instructor.findByIdAndDelete(req.params.id);
  
  if (!instructor) {
    return res.status(404).json({ message: "Instructor not found" });
  }

  res.json({ message: "Instructor deleted successfully" });
});
