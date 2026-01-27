/**
 * Classroom Controller
 * Handles HTTP requests and responses for classroom operations
 */

import Classroom from "../models/Classroom.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";

/**
 * Get all classrooms with optional filtering
 */
export const getClassrooms = asyncHandler(async (req, res) => {
  const { computerLabOnly, excludeComputerLabs } = req.query;
  let query = {};

  // Filter for computer labs only (name contains "ComLab" or equipment includes "Computers")
  if (computerLabOnly === "true") {
    query.$or = [
      { name: { $regex: /ComLab/i } },
      { equipment: { $in: ["Computers"] } }
    ];
  }

  // Filter to exclude computer labs
  if (excludeComputerLabs === "true") {
    query.$nor = [
      { name: { $regex: /ComLab/i } },
      { equipment: { $in: ["Computers"] } }
    ];
  }

  const classrooms = await Classroom.find(query).lean();
  res.json(classrooms);
});

/**
 * Get classroom by ID
 */
export const getClassroomById = asyncHandler(async (req, res) => {
  const classroom = await Classroom.findById(req.params.id).lean();
  
  if (!classroom) {
    return res.status(404).json({ msg: "Classroom not found" });
  }
  
  res.json(classroom);
});

/**
 * Create a new classroom
 */
export const createClassroom = asyncHandler(async (req, res) => {
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
});

/**
 * Update classroom
 */
export const updateClassroom = asyncHandler(async (req, res) => {
  const version = requireVersion(req.body.version);

  const {
    name,
    capacity,
    location,
    equipment,
    description,
    isAvailable,
    schedules
  } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (capacity !== undefined) updates.capacity = capacity;
  if (location !== undefined) updates.location = location;
  if (equipment !== undefined) updates.equipment = equipment;
  if (description !== undefined) updates.description = description;
  if (isAvailable !== undefined) updates.isAvailable = isAvailable;
  if (schedules !== undefined) updates.schedules = schedules;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ msg: "No fields provided to update" });
  }

  const updateDoc = buildVersionedUpdateDoc(updates);

  const updatedClassroom = await runVersionedUpdate(
    Classroom,
    req.params.id,
    version,
    updateDoc
  );

  if (!updatedClassroom) {
    return respondWithConflict(res, "Classroom");
  }

  res.json(updatedClassroom);
});

/**
 * Delete classroom
 */
export const deleteClassroom = asyncHandler(async (req, res) => {
  const deletedClassroom = await Classroom.findByIdAndDelete(req.params.id).lean();

  if (!deletedClassroom) {
    return res.status(404).json({ msg: "Classroom not found" });
  }

  res.json({ msg: "Classroom deleted successfully" });
});
