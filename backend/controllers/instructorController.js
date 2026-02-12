/**
 * Instructor Controller
 * Handles HTTP requests and responses for instructor operations
 */

import Instructor from "../models/Instructor.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { prepareActivityLog } from "../middleware/activityLogger.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";

/**
 * Get all instructors with pagination and filtering
 */
export const getInstructors = asyncHandler(async (req, res) => {
  const { 
    archived, 
    page = 1, 
    limit = 10, 
    search 
  } = req.query;

  // Build query
  const query = {};
  
  // Filter by archived status if provided
  if (archived !== undefined) {
    query.archived = archived === 'true';
  }

  // Add search functionality
  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }

  // Get total count for pagination
  const total = await Instructor.countDocuments(query);
  
  // Calculate pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;
  const pages = Math.ceil(total / limitNum);

  // Get paginated results
  const instructors = await Instructor.find(query)
    .sort({ name: 1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  // Return paginated response
  res.json({
    data: instructors,
    pagination: {
      total,
      pages,
      page: pageNum,
      limit: limitNum
    }
  });
});

/**
 * Add / Create a new instructor
 */
export const createInstructor = asyncHandler(async (req, res) => {
  const { name } = req.body;

  // Check if instructor already exists (case-insensitive)
  const existingInstructor = await Instructor.findOne({ 
    name: { $regex: new RegExp(`^${name}$`, 'i') } 
  });

  if (existingInstructor) {
    return res.status(400).json({ 
      message: "Instructor with this name already exists" 
    });
  }

  const instructor = new Instructor({ name: name.trim() });
  await instructor.save();

  // Log activity
  prepareActivityLog(
    req,
    "create",
    "Instructor",
    instructor._id,
    instructor.name,
    { name: instructor.name }
  );

  res.status(201).json({
    message: "Instructor added successfully",
    instructor: {
      _id: instructor._id,
      name: instructor.name,
      archived: instructor.archived,
      unavailable: instructor.unavailable,
      unavailableReason: instructor.unavailableReason,
      version: instructor.version
    }
  });
});

/**
 * Update / Edit instructor (includes Archive/Restore)
 */
export const updateInstructor = asyncHandler(async (req, res) => {
  const version = requireVersion(req.body.version);
  const { archived, name, unavailable, unavailableReason } = req.body;

  const originalInstructor = await Instructor.findById(req.params.id).lean();

  if (!originalInstructor) {
    return res.status(404).json({ message: "Instructor not found" });
  }

  const updates = {};

  // Name update with duplicate check
  if (name !== undefined) {
    const existingInstructor = await Instructor.findOne({
      _id: { $ne: req.params.id },
      name: { $regex: new RegExp(`^${name}$`, "i") }
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
    updates.unavailableReason = unavailable
      ? unavailableReason?.trim() || null
      : null;
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

  const changes = {};

  if (updates.name !== undefined && originalInstructor.name !== updates.name) {
    changes.name = {
      old: originalInstructor.name,
      new: updates.name
    };
  }

  if (
    updates.archived !== undefined &&
    originalInstructor.archived !== updates.archived
  ) {
    changes.archived = {
      old: originalInstructor.archived,
      new: updates.archived
    };
  }

  if (
    updates.unavailable !== undefined &&
    originalInstructor.unavailable !== updates.unavailable
  ) {
    changes.unavailable = {
      old: originalInstructor.unavailable,
      new: updates.unavailable
    };

    changes.unavailableReason = {
      old: originalInstructor.unavailableReason,
      new: updates.unavailableReason
    };
  }

  let action = "update";
  if (updates.archived !== undefined) {
    action = updates.archived ? "archive" : "restore";
  }

  prepareActivityLog(
    req,
    action,
    "Instructor",
    instructor._id,
    instructor.name,
    Object.keys(changes).length ? changes : null
  );

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

  // Log activity
  prepareActivityLog(
    req,
    "delete",
    "Instructor",
    instructor._id,
    instructor.name
  );

  res.json({ message: "Instructor deleted successfully" });
});