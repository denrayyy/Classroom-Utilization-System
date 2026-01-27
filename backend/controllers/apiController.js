/**
 * API Controller
 * Handles HTTP requests and responses for example API endpoints
 */

import { asyncHandler } from "../middleware/errorHandler.js";

// Mock data for classrooms. Replace with Classroom.find(...) once MongoDB is wired.
const classroomStatuses = [
  { classroomId: 'CR-101', building: 'Main', capacity: 40, occupied: 28, status: 'In Use' },
  { classroomId: 'CR-102', building: 'Main', capacity: 35, occupied: 0, status: 'Available' },
  { classroomId: 'CR-201', building: 'North', capacity: 50, occupied: 50, status: 'Full' },
];

/**
 * Log class attendance
 * TODO: Replace mock implementation with actual database operations
 */
export const logAttendance = asyncHandler(async (req, res) => {
  const { teacherId, classroomId, time, status = 'present' } = req.body || {};

  if (!teacherId || !classroomId) {
    return res.status(400).json({
      error: 'Missing required fields: teacherId and classroomId are required.'
    });
  }

  const timestamp = time ? new Date(time).toISOString() : new Date().toISOString();

  // Example: Replace the following mock return with a real DB write via Mongoose
  // const attendance = await TimeIn.create({ teacherId, classroomId, status, timestamp: new Date(timestamp) });

  return res.status(201).json({
    message: 'Attendance logged successfully.',
    data: {
      teacherId,
      classroomId,
      status,
      timestamp,
    },
  });
});

/**
 * Get classroom status
 * TODO: Replace mock implementation with actual database operations
 */
export const getClassroomStatus = asyncHandler(async (req, res) => {
  const { building, status } = req.query || {};

  // Replace with Mongoose find(filter) when DB is connected
  let results = classroomStatuses;
  if (building) {
    results = results.filter((c) => String(c.building).toLowerCase() === String(building).toLowerCase());
  }
  if (status) {
    results = results.filter((c) => String(c.status).toLowerCase() === String(status).toLowerCase());
  }

  return res.status(200).json({ count: results.length, classrooms: results });
});
