/**
 * Usage Controller
 * Handles HTTP requests and responses for classroom usage operations
 */

import ClassroomUsage from "../models/ClassroomUsage.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";

/**
 * Get all classroom usage data
 */
export const getUsage = asyncHandler(async (req, res) => {
  const usage = await ClassroomUsage.find()
    .populate("classroom", "name location capacity")
    .populate("teacher", "firstName lastName email")
    .populate("schedule")
    .sort({ date: -1 });
  res.json(usage);
});

/**
 * Get daily usage statistics
 */
export const getDailyUsage = asyncHandler(async (req, res) => {
  const { date } = req.query;
  let query = {};

  if (date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    query.date = { $gte: startOfDay, $lte: endOfDay };
  }

  const usage = await ClassroomUsage.find(query)
    .populate("classroom", "name location capacity")
    .populate("teacher", "firstName lastName email")
    .sort({ date: -1 });

  res.json(usage);
});

/**
 * Get specific usage record by ID
 */
export const getUsageById = asyncHandler(async (req, res) => {
  const usage = await ClassroomUsage.findById(req.params.id)
    .populate("classroom", "name location capacity")
    .populate("teacher", "firstName lastName email")
    .populate("schedule");

  if (!usage) {
    return res.status(404).json({ message: "Usage record not found" });
  }

  res.json(usage);
});

/**
 * Create classroom usage record
 */
export const createUsage = asyncHandler(async (req, res) => {
  const {
    classroom,
    teacher,
    schedule,
    date,
    timeIn,
    timeOut,
    status,
    utilizationRate,
    notes
  } = req.body;

  const usage = new ClassroomUsage({
    classroom,
    teacher,
    schedule,
    date,
    timeIn,
    timeOut,
    status: status || "on-time",
    utilizationRate,
    notes
  });

  await usage.save();
  await usage.populate([
    { path: "classroom", select: "name location capacity" },
    { path: "teacher", select: "firstName lastName email" },
    { path: "schedule" }
  ]);

  res.status(201).json({
    message: "Usage record created successfully",
    usage
  });
});

/**
 * Update usage record
 */
export const updateUsage = asyncHandler(async (req, res) => {
  const version = requireVersion(req.body.version);

  const {
    timeIn,
    timeOut,
    status,
    utilizationRate,
    notes
  } = req.body;

  const updates = {};
  if (timeIn !== undefined) updates.timeIn = timeIn;
  if (timeOut !== undefined) updates.timeOut = timeOut;
  if (status !== undefined) updates.status = status;
  if (utilizationRate !== undefined) updates.utilizationRate = utilizationRate;
  if (notes !== undefined) updates.notes = notes;

  const updateDoc = buildVersionedUpdateDoc(updates);

  const usage = await runVersionedUpdate(
    ClassroomUsage,
    req.params.classroomId,
    version,
    updateDoc
  );

  if (!usage) {
    return respondWithConflict(res, "Usage Record");
  }

  res.json({
    message: "Usage record updated successfully",
    usage
  });
});

/**
 * Delete usage record
 */
export const deleteUsage = asyncHandler(async (req, res) => {
  const usage = await ClassroomUsage.findByIdAndDelete(req.params.classroomId);

  if (!usage) {
    return res.status(404).json({ message: "Usage record not found" });
  }

  res.json({ message: "Usage record deleted successfully" });
});
