/**
 * Schedule Controller
 * Handles HTTP requests and responses for schedule operations
 */

import * as scheduleService from "../services/scheduleService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { prepareActivityLog } from "../middleware/activityLogger.js";
import Schedule from "../models/Schedule.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";

/**
 * Get all schedules with pagination, search, filter, and sort
 */
export const getSchedules = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    teacher,
    classroom,
    status,
    dayOfWeek,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build filter
  const filter = {};
  if (teacher) filter.teacher = teacher;
  if (classroom) filter.classroom = classroom;
  if (status) filter.status = status;
  if (dayOfWeek !== undefined) filter.dayOfWeek = parseInt(dayOfWeek);

  // Build sort
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const result = await scheduleService.getSchedules({
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    filter,
    sort,
  });

  res.json(result);
});

/**
 * Get schedule by ID
 */
export const getScheduleById = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.getScheduleById(req.params.id);

  if (!schedule) {
    return res.status(404).json({ message: "Schedule not found" });
  }

  res.json(schedule);
});

/**
 * Create new schedule
 */
export const createSchedule = asyncHandler(async (req, res) => {
  const {
    teacher,
    classroom,
    subject,
    courseCode,
    dayOfWeek,
    startTime,
    endTime,
    status,
    semester,
    academicYear,
    notes,
  } = req.body;

  // Validate required fields
  if (!teacher || !classroom || !subject || dayOfWeek === undefined || !startTime || !endTime) {
    return res.status(400).json({
      message: "Missing required fields: teacher, classroom, subject, dayOfWeek, startTime, endTime",
    });
  }

  // Validate time format and logical order
  if (startTime >= endTime) {
    return res.status(400).json({
      message: "Start time must be before end time",
    });
  }

  const schedule = await scheduleService.createSchedule({
    teacher,
    classroom,
    subject,
    courseCode,
    dayOfWeek,
    startTime,
    endTime,
    status,
    semester,
    academicYear,
    notes,
  });

  // Log activity
  prepareActivityLog(
    req,
    "create",
    "Schedule",
    schedule._id,
    `${schedule.subject} (${schedule.courseCode || "No Code"})`
  );

  res.status(201).json({
    message: "Schedule created successfully",
    schedule,
  });
});

/**
 * Update schedule
 */
export const updateSchedule = asyncHandler(async (req, res) => {
  const version = requireVersion(req.body.version);

  const {
    teacher,
    classroom,
    subject,
    courseCode,
    dayOfWeek,
    startTime,
    endTime,
    status,
    semester,
    academicYear,
    notes,
  } = req.body;

  // Validate time format and logical order if times are being updated
  if (startTime !== undefined && endTime !== undefined && startTime >= endTime) {
    return res.status(400).json({
      message: "Start time must be before end time",
    });
  }

  const updates = {};
  if (teacher !== undefined) updates.teacher = teacher;
  if (classroom !== undefined) updates.classroom = classroom;
  if (subject !== undefined) updates.subject = subject;
  if (courseCode !== undefined) updates.courseCode = courseCode;
  if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek;
  if (startTime !== undefined) updates.startTime = startTime;
  if (endTime !== undefined) updates.endTime = endTime;
  if (status !== undefined) updates.status = status;
  if (semester !== undefined) updates.semester = semester;
  if (academicYear !== undefined) updates.academicYear = academicYear;
  if (notes !== undefined) updates.notes = notes;

  // Check for conflicts (this will throw if conflict exists)
  await scheduleService.updateSchedule(req.params.id, updates, version);

  const updateDoc = buildVersionedUpdateDoc(updates);

  const schedule = await runVersionedUpdate(Schedule, req.params.id, version, updateDoc);

  if (!schedule) {
    return respondWithConflict(res, "Schedule");
  }

  await schedule.populate("teacher", "firstName lastName email");
  await schedule.populate("classroom", "name location capacity");

  // Log activity
  prepareActivityLog(
    req,
    "update",
    "Schedule",
    schedule._id,
    `${schedule.subject} (${schedule.courseCode || "No Code"})`,
    updates
  );

  res.json({
    message: "Schedule updated successfully",
    schedule,
  });
});

/**
 * Delete schedule
 */
export const deleteSchedule = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.deleteSchedule(req.params.id);

  // Log activity
  prepareActivityLog(
    req,
    "delete",
    "Schedule",
    schedule._id,
    `${schedule.subject} (${schedule.courseCode || "No Code"})`
  );

  res.json({ message: "Schedule deleted successfully" });
});

