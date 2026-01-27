/**
 * Schedule Service
 * Reusable business logic for schedule operations
 */

import Schedule from "../models/Schedule.js";

/**
 * Check if two time ranges overlap
 */
const timeRangesOverlap = (start1, end1, start2, end2) => {
  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);

  return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
};

/**
 * Check for schedule conflicts
 * A conflict occurs when:
 * 1. Same classroom on same day with overlapping times, OR
 * 2. Same teacher on same day with overlapping times
 */
export const checkScheduleConflict = async (scheduleData, excludeScheduleId = null) => {
  const { classroom, teacher, dayOfWeek, startTime, endTime, status } = scheduleData;

  // Only check conflicts for active/pending schedules
  const statusFilter = { $in: ["pending", "approved", "active"] };
  if (status) {
    statusFilter.$in = statusFilter.$in.includes(status) ? [status] : statusFilter.$in;
  }

  // Check classroom conflicts
  const classroomQuery = {
    classroom,
    dayOfWeek,
    status: statusFilter,
  };
  if (excludeScheduleId) {
    classroomQuery._id = { $ne: excludeScheduleId };
  }

  const classroomConflicts = await Schedule.find(classroomQuery);

  for (const conflict of classroomConflicts) {
    if (timeRangesOverlap(startTime, endTime, conflict.startTime, conflict.endTime)) {
      throw new Error(
        `Classroom conflict: Another schedule (${conflict.subject || conflict.courseCode || "Schedule"}) exists in the same classroom at overlapping times on the same day.`
      );
    }
  }

  // Check teacher conflicts
  const teacherQuery = {
    teacher,
    dayOfWeek,
    status: statusFilter,
  };
  if (excludeScheduleId) {
    teacherQuery._id = { $ne: excludeScheduleId };
  }

  const teacherConflicts = await Schedule.find(teacherQuery);

  for (const conflict of teacherConflicts) {
    if (timeRangesOverlap(startTime, endTime, conflict.startTime, conflict.endTime)) {
      throw new Error(
        `Teacher conflict: The teacher already has another schedule (${conflict.subject || conflict.courseCode || "Schedule"}) at overlapping times on the same day.`
      );
    }
  }

  return true;
};

/**
 * Get all schedules with pagination
 */
export const getSchedules = async (options = {}) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    filter = {},
    sort = { createdAt: -1 },
  } = options;

  const skip = (page - 1) * limit;

  // Build search query
  const searchQuery = search
    ? {
        $or: [
          { subject: { $regex: search, $options: "i" } },
          { courseCode: { $regex: search, $options: "i" } },
          { notes: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  // Combine filters
  const query = { ...searchQuery, ...filter };

  // Get total count for pagination
  const total = await Schedule.countDocuments(query);

  // Get schedules with population
  const schedules = await Schedule.find(query)
    .populate("teacher", "firstName lastName email")
    .populate("classroom", "name location capacity")
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  return {
    schedules,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get schedule by ID
 */
export const getScheduleById = async (scheduleId) => {
  return await Schedule.findById(scheduleId)
    .populate("teacher", "firstName lastName email")
    .populate("classroom", "name location capacity");
};

/**
 * Create new schedule
 */
export const createSchedule = async (scheduleData) => {
  // Check for conflicts
  await checkScheduleConflict(scheduleData);

  const schedule = new Schedule({
    ...scheduleData,
    status: scheduleData.status || "pending",
  });

  await schedule.save();
  await schedule.populate("teacher", "firstName lastName email");
  await schedule.populate("classroom", "name location capacity");

  return schedule;
};

/**
 * Update schedule
 */
export const updateSchedule = async (scheduleId, updateData, version) => {
  const existingSchedule = await Schedule.findById(scheduleId);
  if (!existingSchedule) {
    throw new Error("Schedule not found");
  }

  // Merge existing data with updates for conflict checking
  const mergedData = {
    classroom: updateData.classroom !== undefined ? updateData.classroom : existingSchedule.classroom,
    teacher: updateData.teacher !== undefined ? updateData.teacher : existingSchedule.teacher,
    dayOfWeek: updateData.dayOfWeek !== undefined ? updateData.dayOfWeek : existingSchedule.dayOfWeek,
    startTime: updateData.startTime !== undefined ? updateData.startTime : existingSchedule.startTime,
    endTime: updateData.endTime !== undefined ? updateData.endTime : existingSchedule.endTime,
    status: updateData.status !== undefined ? updateData.status : existingSchedule.status,
  };

  // Check for conflicts only if relevant fields are being updated
  if (
    updateData.classroom !== undefined ||
    updateData.teacher !== undefined ||
    updateData.dayOfWeek !== undefined ||
    updateData.startTime !== undefined ||
    updateData.endTime !== undefined
  ) {
    await checkScheduleConflict(mergedData, scheduleId);
  }

  // Note: Actual update is done via MVCC in controller
  return mergedData;
};

/**
 * Delete schedule
 */
export const deleteSchedule = async (scheduleId) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new Error("Schedule not found");
  }

  await Schedule.findByIdAndDelete(scheduleId);
  return schedule;
};

