/**
 * Time-in Controller
 * Handles HTTP requests and responses for time-in/time-out, evidence, verification, and PDF export.
 */

import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import TimeIn from "../models/TimeIn.js";
import Classroom from "../models/Classroom.js";
import Instructor from "../models/Instructor.js";
import Holiday from "../models/Holiday.js";
import User from "../models/User.js";
import { createNotification } from "../utils/notifications.js";
import { deriveRemarks } from "../utils/deriveRemarks.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const evidenceDir = path.join(__dirname, "../uploads/evidence");

/**
 * Auto time-out expired sessions
 * Runs before any time-in query to clean up old sessions
 */
const autoTimeoutExpiredSessions = async () => {
  try {
    const cooldownMs = (2 * 60 * 60 * 1000) + (30 * 60 * 1000); // 2h 30m
    const expiryTime = new Date(Date.now() - cooldownMs);
    
    const result = await TimeIn.updateMany(
      {
        timeOut: { $exists: false },
        timeIn: { $lte: expiryTime }
      },
      {
        $set: {
          timeOut: new Date(),
          status: "auto-timed-out",
          autoTimedOutAt: new Date()
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`✅ Auto timed-out ${result.modifiedCount} expired sessions`);
    }
    
    return result;
  } catch (error) {
    console.error("Error auto time-out:", error);
    return null;
  }
};

/**
 * Check if today is a holiday
 */
const checkHolidayToday = async () => {
  try {
    const now = new Date();
    const manilaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Manila" }),
    );

    const startOfDay = new Date(manilaTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(manilaTime);
    endOfDay.setHours(23, 59, 59, 999);

    const holiday = await Holiday.findOne({
      date: { $gte: startOfDay, $lt: endOfDay },
      isActive: true,
    });

    return holiday;
  } catch (error) {
    return null;
  }
};

/**
 * Helper: Check if time is late
 */
function isTimeLate(actualTime, scheduledStartTime) {
  if (!scheduledStartTime) return false;
  
  const [schedHour, schedMin] = scheduledStartTime.split(':').map(Number);
  const actualHour = actualTime.getHours();
  const actualMin = actualTime.getMinutes();
  
  return (actualHour > schedHour) || (actualHour === schedHour && actualMin > schedMin + 5);
}

/**
 * Helper: Check time overlap
 */
function isTimeOverlap(time1, time2) {
  const [start1, end1] = time1.split('-').map(t => timeToMinutes(t));
  const [start2, end2] = time2.split('-').map(t => timeToMinutes(t));
  return start1 < end2 && start2 < end1;
}

function normalizeDayName(day) {
  return String(day || "").trim().toLowerCase();
}

function timeToMinutes(timeStr) {
  const raw = String(timeStr || "").trim().toUpperCase();
  if (!raw) return NaN;

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return NaN;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const meridiem = match[3];

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return NaN;

  if (!meridiem) {
    // Schedule convention: bare 1:00-6:00 values are afternoon classes.
    if (hours >= 1 && hours <= 6) {
      hours += 12;
    }
  } else {
    if (meridiem === "AM" && hours === 12) hours = 0;
    if (meridiem === "PM" && hours !== 12) hours += 12;
  }

  return hours * 60 + minutes;
}

function getDayName(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function parseScheduleRange(scheduleTime) {
  const parts = String(scheduleTime || "")
    .split("-")
    .map((value) => value?.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  return {
    start: parts[0],
    end: parts[parts.length - 1],
  };
}

function parseRequestedTimeToDate(timeInput, baseDate = new Date()) {
  const raw = String(timeInput || "").trim().toUpperCase();
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const meridiem = match[3];

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 1 ||
    hours > 12 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  hours = hours % 12;
  if (meridiem === "PM") hours += 12;

  const parsedDate = new Date(baseDate);
  parsedDate.setHours(hours, minutes, 0, 0);
  return parsedDate;
}

function getActiveScheduleForTime(schedules = [], currentTime) {
  const currentDay = normalizeDayName(getDayName(currentTime));
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  return (
    schedules.find((schedule) => {
      if (!schedule?.day || !schedule?.time) return false;
      if (normalizeDayName(schedule.day) !== currentDay) return false;

      const range = parseScheduleRange(schedule.time);
      if (!range) return false;

      const startMinutes = timeToMinutes(range.start);
      const endMinutes = timeToMinutes(range.end);
      if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) return false;

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }) || null
  );
}

const autoTimeoutExpiredSessionsBySchedule = async (currentTime = new Date()) => {
  try {
    const cooldownMs = (2 * 60 * 60 * 1000) + (30 * 60 * 1000); // 2h 30m fallback
    const activeTimeIns = await TimeIn.find({
      timeOut: { $exists: false },
    })
      .populate("classroom", "name schedules")
      .exec();

    const recordsToTimeout = [];

    activeTimeIns.forEach((record) => {
      let shouldTimeout = false;

      const matchedSchedule = getActiveScheduleForTime(
        record.classroom?.schedules || [],
        record.timeIn,
      );

      if (matchedSchedule) {
        const range = parseScheduleRange(matchedSchedule.time);
        const endMinutes = range ? timeToMinutes(range.end) : NaN;

        if (!Number.isNaN(endMinutes)) {
          const scheduleEndTime = new Date(record.timeIn);
          scheduleEndTime.setHours(
            Math.floor(endMinutes / 60),
            endMinutes % 60,
            0,
            0,
          );

          shouldTimeout = currentTime >= scheduleEndTime;
        }
      }

      if (!shouldTimeout) {
        shouldTimeout = currentTime - new Date(record.timeIn) >= cooldownMs;
      }

      if (shouldTimeout) {
        recordsToTimeout.push(record._id);
      }
    });

    if (!recordsToTimeout.length) {
      return { modifiedCount: 0 };
    }

    const result = await TimeIn.updateMany(
      {
        _id: { $in: recordsToTimeout },
        timeOut: { $exists: false },
      },
      {
        $set: {
          timeOut: currentTime,
          status: "auto-timed-out",
          autoTimedOutAt: currentTime,
        },
      },
    );

    if (result.modifiedCount > 0) {
      console.log(`Auto timed-out ${result.modifiedCount} expired sessions`);
    }

    return result;
  } catch (error) {
    console.error("Error auto time-out:", error);
    return null;
  }
};

/**
 * Create time-in record with evidence upload.
 * FEATURES:
 * 1. Actual check-in time (not scheduled)
 * 2. Holiday detection
 * 3. Instructor travel status check
 * 4. Classroom occupancy check
 * 5. No-class support
 * 6. Signature capture
 */
export const create = asyncHandler(async (req, res) => {
  // ✅ Auto time-out expired sessions BEFORE checking for active time-ins
  await autoTimeoutExpiredSessionsBySchedule(req.worldTime ?? new Date());
  
  const { 
    classroom, 
    instructorName, 
    section,
    subjectCode,
    reason,
    customTimeIn,
    remarks, 
    classType = "in-class",
    signature,
    scheduledStartTime  // ✅ Scheduled time from schedule (e.g., "7:30")
  } = req.body;

  // ✅ Get ACTUAL current time (or manual custom time)
  const actualTimeIn = customTimeIn ? new Date(customTimeIn) : (req.worldTime ?? new Date());
  if (Number.isNaN(actualTimeIn.getTime())) {
    return res.status(400).json({ message: "Invalid customTimeIn value" });
  }
  const normalizedClassType = classType === "no-class" ? "no-class" : "in-class";
  let matchedSchedule = null;
  let finalInstructorName = instructorName?.trim() || "";
  let finalSection = section?.trim() || "";
  let finalSubjectCode = subjectCode?.trim() || "";
  let finalScheduledStartTime = scheduledStartTime?.trim() || "";
  const finalReason = reason?.trim() || "";
  
  // ✅ Check if today is a holiday
  const holiday = await checkHolidayToday();
  const isHoliday = !!holiday;

  // ✅ Check instructor status (travel/leave/unavailable)
  let instructorStatus = {
    onTravel: false,
    onLeave: false,
    unavailable: false,
    travelDetails: null
  };
  
  if (finalInstructorName) {
    const instructor = await Instructor.findOne({ 
      name: { $regex: new RegExp(finalInstructorName, 'i') } 
    });
    
    if (instructor) {
      instructorStatus = {
        onTravel: instructor.travelStatus === 'on-travel',
        onLeave: instructor.travelStatus === 'on-leave',
        unavailable: instructor.unavailable || false,
        travelDetails: instructor.travelDetails || null,
        travelStatus: instructor.travelStatus || 'available'
      };
    }
  }

  if (!classroom) {
    return res.status(400).json({ message: "Classroom is required" });
  }

  const classroomExists = await Classroom.findById(classroom).lean();
  if (!classroomExists) {
    return res.status(404).json({ message: "Classroom not found" });
  }

  if (normalizedClassType === "in-class") {
    matchedSchedule = getActiveScheduleForTime(
      classroomExists.schedules || [],
      actualTimeIn,
    );

    if (!matchedSchedule) {
      return res.status(409).json({
        message: `No scheduled class is active in ${classroomExists.name} at this time.`,
        classroom: {
          id: classroomExists._id,
          name: classroomExists.name,
          location: classroomExists.location
        },
        currentDay: getDayName(actualTimeIn),
        currentTime: actualTimeIn.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      });
    }

    finalInstructorName = matchedSchedule.instructor?.trim() || "";
    finalSection = matchedSchedule.section?.trim() || "";
    finalSubjectCode = matchedSchedule.subjectCode?.trim() || "";
    finalScheduledStartTime =
      parseScheduleRange(matchedSchedule.time)?.start || "";

    if (!finalInstructorName) {
      return res.status(409).json({
        message: `The active schedule in ${classroomExists.name} does not have an assigned instructor.`,
      });
    }

    // ✅ Check for schedule conflicts
    if (finalScheduledStartTime) {
      const conflictingSchedule = classroomExists.schedules?.find(s => {
        const scheduleRange = parseScheduleRange(s.time);
        return scheduleRange?.start === finalScheduledStartTime;
      });

      if (conflictingSchedule) {
        // Classroom has a scheduled class at this time
        console.log(`📅 Scheduled class found: ${conflictingSchedule.section} at ${conflictingSchedule.time}`);
      }
    }
  } else if (!finalReason) {
    return res.status(400).json({ message: "Reason is required when class type is no-class" });
  }

  if (normalizedClassType === "no-class" && !finalInstructorName) {
    finalInstructorName = "No Class";
  }

  // ✅ Check if classroom is already occupied
  const occupiedClassroom = await TimeIn.findOne({
    classroom: classroom,
    timeOut: { $exists: false }
  }).populate("student", "firstName lastName");

  if (occupiedClassroom) {
    return res.status(409).json({
      message: `Classroom ${classroomExists.name} is currently occupied by ${occupiedClassroom.student?.firstName || 'someone'}.`,
      classroom: {
        id: classroomExists._id,
        name: classroomExists.name,
        location: classroomExists.location
      },
      occupiedBy: {
        name: `${occupiedClassroom.student?.firstName || ''} ${occupiedClassroom.student?.lastName || ''}`.trim(),
        timeIn: occupiedClassroom.timeIn,
        instructorName: occupiedClassroom.instructorName
      }
    });
  }

  // ✅ Check if student has any active time-in
  const activeTimeIn = await TimeIn.findOne({
    student: req.user._id,
    timeOut: { $exists: false }
  });

  if (activeTimeIn) {
    const activeClassroom = await Classroom.findById(activeTimeIn.classroom);
    return res.status(429).json({
      message: `You already have an active time-in at ${activeClassroom?.name || 'another classroom'}. Please time-out first.`,
      activeTimeIn: {
        id: activeTimeIn._id,
        classroom: activeClassroom?.name || 'Unknown',
        timeIn: activeTimeIn.timeIn
      }
    });
  }

  // ✅ Check for same user same classroom cooldown (2.5 hours)
  const lastTimeIn = await TimeIn.findOne({
    student: req.user._id,
    classroom: classroom
  }).sort({ timeIn: -1 });

  if (lastTimeIn) {
    const lastTime = new Date(lastTimeIn.timeIn);
    const diffMs = actualTimeIn - lastTime;
    const cooldownMs = (2 * 60 * 60 * 1000) + (30 * 60 * 1000);

    if (diffMs < cooldownMs) {
      const remainingMs = cooldownMs - diffMs;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return res.status(429).json({
        message: `Please wait ${remainingMinutes} minute(s) before timing in to this classroom again.`,
        retryAfterMinutes: remainingMinutes
      });
    }
  }

  // ✅ Check if instructor is already teaching elsewhere (in-class only)
  if (normalizedClassType === "in-class" && finalInstructorName) {
    const activeInstructorTimeIn = await TimeIn.findOne({
      instructorName: finalInstructorName,
      timeOut: { $exists: false }
    }).populate("classroom", "name");

    if (activeInstructorTimeIn) {
      return res.status(409).json({
        message: `Instructor ${finalInstructorName} is currently teaching in ${activeInstructorTimeIn.classroom?.name || 'another classroom'}.`,
        activeTeachingSession: {
          id: activeInstructorTimeIn._id,
          classroom: activeInstructorTimeIn.classroom?.name || 'Unknown',
          timeIn: activeInstructorTimeIn.timeIn
        }
      });
    }
  }

  // ✅ Create time-in with all data
  const derivedRemarks = deriveRemarks({
    classType: normalizedClassType,
    reason: finalReason,
  });
  const finalRemarks = String(remarks || "").trim() || derivedRemarks;

  const timeInRecord = new TimeIn({
    student: req.user._id,
    classroom,
    instructorName: finalInstructorName,
    section: finalSection,
    subjectCode: finalSubjectCode,
    evidence: req.file
      ? {
          filename: req.file.filename,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
          path: req.file.path,
        }
      : {},
    timeIn: actualTimeIn,              // ✅ ACTUAL check-in time
    scheduledStartTime: finalScheduledStartTime, // ✅ Scheduled time for reference
    isLate: isTimeLate(actualTimeIn, finalScheduledStartTime), // ✅ Late detection
    remarks: finalRemarks,
    classType: normalizedClassType,
    reason: finalReason,
    customTimeIn: customTimeIn ? actualTimeIn : null,
    signature: signature ? {
      data: signature,
      capturedAt: actualTimeIn
    } : undefined,
    isHoliday: isHoliday,              // ✅ Holiday flag
    holidayInfo: holiday ? {
      name: holiday.name,
      type: holiday.type,
      description: holiday.description
    } : null,
    instructorStatus: instructorStatus  // ✅ Instructor travel/leave status
  });

  await timeInRecord.save();
  
  // ✅ Populate for response
  await timeInRecord.populate([
    { path: "student", select: "firstName lastName email employeeId department gender" },
    { path: "classroom", select: "name location capacity" }
  ]);

  try {
    const recipients = await User.find({
      role: { $in: ["admin", "monitor"] },
      isActive: true,
    })
      .select("_id")
      .lean();

    const studentFullName = `${timeInRecord.student?.firstName || ""} ${timeInRecord.student?.lastName || ""}`.trim() || "Unknown User";
    const sectionLabel = finalSection || "Unknown Section";
    const subjectLabel = finalSubjectCode || "Unknown Subject";
    const roomLabel = timeInRecord.classroom?.name || "Unknown Classroom";
    const timeLabel = new Date(actualTimeIn).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const title = "New Time-In";
    const message = `${sectionLabel} - ${subjectLabel} time-in at ${roomLabel} by ${studentFullName} (${timeLabel})`;
    const link = "/monitoring";

    await Promise.all(
      recipients.map((recipient) =>
        createNotification(recipient._id, title, message, link),
      ),
    );
  } catch (notificationError) {
    console.error("Failed to create time-in notifications:", notificationError);
  }

  // ✅ Build response with warnings
  const warnings = [];
  
  if (isHoliday) {
    warnings.push({
      type: 'holiday',
      message: `Today is ${holiday.name} - ${holiday.type} holiday`,
      holidayName: holiday.name,
      holidayType: holiday.type
    });
  }
  
  if (instructorStatus.onTravel) {
    warnings.push({
      type: 'travel',
      message: `Instructor ${finalInstructorName} is currently on official travel`,
      travelDetails: instructorStatus.travelDetails
    });
  }
  
  if (instructorStatus.onLeave) {
    warnings.push({
      type: 'leave',
      message: `Instructor ${finalInstructorName} is currently on leave`,
      travelDetails: instructorStatus.travelDetails
    });
  }
  
  if (timeInRecord.isLate) {
    warnings.push({
      type: 'late',
      message: `Late check-in. Scheduled: ${finalScheduledStartTime}, Actual: ${actualTimeIn.toLocaleTimeString()}`
    });
  }

  res.status(201).json({
    message: `Successfully timed in to ${timeInRecord.classroom?.name || 'classroom'} with instructor ${finalInstructorName}`,
    timeInRecord: {
      id: timeInRecord._id,
      student: timeInRecord.student,
      classroom: timeInRecord.classroom,
      instructorName: timeInRecord.instructorName,
      section: timeInRecord.section,
      subjectCode: timeInRecord.subjectCode,
      timeIn: timeInRecord.timeIn,
      scheduledStartTime: timeInRecord.scheduledStartTime,
      isLate: timeInRecord.isLate,
      date: timeInRecord.date,
      remarks: timeInRecord.remarks,
      classType: timeInRecord.classType,
      reason: timeInRecord.reason,
      customTimeIn: timeInRecord.customTimeIn,
      isHoliday: timeInRecord.isHoliday,
      holidayInfo: timeInRecord.holidayInfo,
      instructorStatus: timeInRecord.instructorStatus,
      evidence: {
        filename: timeInRecord.evidence.filename,
        originalName: timeInRecord.evidence.originalName,
        mimetype: timeInRecord.evidence.mimetype,
        size: timeInRecord.evidence.size,
      },
      matchedSchedule
    },
    warnings: warnings.length > 0 ? warnings : undefined
  });
});

/**
 * Record time-out for the most recent active time-in
 */
export const timeout = asyncHandler(async (req, res) => {
  await autoTimeoutExpiredSessionsBySchedule();
  
  const timeInRecord = await TimeIn.findOne({
    student: req.user._id,
    timeOut: { $exists: false },
  }).sort({ timeIn: -1 });

  if (!timeInRecord) {
    return res.status(404).json({
      message: "No active time-in record found. Please time-in first.",
    });
  }

  const currentTime = req.worldTime ?? new Date();
  timeInRecord.timeOut = currentTime;
  timeInRecord.status = "completed";
  await timeInRecord.save();

  await timeInRecord.populate([
    { path: "student", select: "firstName lastName email employeeId department gender" },
    { path: "classroom", select: "name location capacity" }
  ]);

  res.json({
    message: "Time-out recorded successfully",
    timeInRecord: {
      id: timeInRecord._id,
      student: timeInRecord.student,
      classroom: timeInRecord.classroom,
      instructorName: timeInRecord.instructorName,
      timeIn: timeInRecord.timeIn,
      timeOut: timeInRecord.timeOut,
      date: timeInRecord.date,
      status: timeInRecord.status,
    },
  });
});

/**
 * List time-in records with optional filters
 * Auto time-out expired sessions
 */
export const list = asyncHandler(async (req, res) => {
  await autoTimeoutExpiredSessionsBySchedule();
  
  const { student, classroom, date, status, startDate, endDate, instructorName } = req.query;
  const query = {};

  query.isArchived = { $ne: true };

  if (req.user.role === "student") {
    query.student = req.user._id;
  }
  
  if (student && req.user.role === "admin") {
    query.student = student;
  }

  if (classroom) query.classroom = classroom;
  if (instructorName) query.instructorName = { $regex: new RegExp(instructorName, 'i') };
  if (status) query.status = status;

  if (date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    query.date = { $gte: startOfDay, $lte: endOfDay };
  }

  if (startDate && endDate) {
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    parsedStartDate.setHours(0, 0, 0, 0);
    parsedEndDate.setHours(23, 59, 59, 999);
    query.date = { $gte: parsedStartDate, $lte: parsedEndDate };
  }

  const timeInRecords = await TimeIn.find(query)
    .populate("student", "firstName lastName email employeeId department gender")
    .populate("classroom", "name location capacity")
    .populate("verifiedBy", "firstName lastName")
    .sort({ date: -1, timeIn: -1 });

  const withDerivedRemarks = timeInRecords.map((record) => {
    const obj = record.toObject({ virtuals: true });
    const existing = String(obj.remarks || "").trim();
    const computed = deriveRemarks({ classType: obj.classType, reason: obj.reason });
    return { ...obj, remarks: existing || computed };
  });

  res.json(withDerivedRemarks);
});

/**
 * Get active time-ins for monitoring display
 */
export const getActiveTimeIns = asyncHandler(async (req, res) => {
  await autoTimeoutExpiredSessionsBySchedule();
  
  const activeTimeIns = await TimeIn.find({ 
    timeOut: { $exists: false },
    isArchived: { $ne: true }
  })
    .populate("classroom", "name location")
    .populate("student", "firstName lastName")
    .sort({ timeIn: -1 });

  const monitoringData = activeTimeIns.map(record => {
    const existing = String(record.remarks || "").trim();
    const computed = deriveRemarks({ classType: record.classType, reason: record.reason });
    return ({
    _id: record._id,
    classroom: record.classroom?.name || 'Unknown',
    location: record.classroom?.location || '',
    instructorName: record.instructorName,
    section: record.section,
    subjectCode: record.subjectCode,
    studentName: `${record.student?.firstName || ''} ${record.student?.lastName || ''}`.trim(),
    timeIn: record.timeIn,
    scheduledStartTime: record.scheduledStartTime,
    isLate: record.isLate,
    classType: record.classType,
    remarks: existing || computed,
    isHoliday: record.isHoliday,
    holidayInfo: record.holidayInfo,
    instructorStatus: record.instructorStatus
    });
  });

  res.json(monitoringData);
});

/**
 * Check classroom availability
 */
export const checkAvailability = asyncHandler(async (req, res) => {
  const { classroomId } = req.params;
  
  // Check for active time-in
  const activeTimeIn = await TimeIn.findOne({
    classroom: classroomId,
    timeOut: { $exists: false }
  }).populate("student", "firstName lastName");

  if (activeTimeIn) {
    return res.json({
      available: false,
      reason: 'occupied',
      occupiedBy: `${activeTimeIn.student?.firstName || ''} ${activeTimeIn.student?.lastName || ''}`.trim(),
      instructorName: activeTimeIn.instructorName,
      since: activeTimeIn.timeIn,
      section: activeTimeIn.section,
      subjectCode: activeTimeIn.subjectCode
    });
  }

  res.json({ available: true });
});

/**
 * Check if today is a holiday
 */
export const checkHoliday = asyncHandler(async (req, res) => {
  const holiday = await checkHolidayToday();
  
  res.json({
    isHoliday: !!holiday,
    holiday: holiday ? {
      name: holiday.name,
      type: holiday.type,
      description: holiday.description
    } : null
  });
});

/**
 * Serve evidence image by filename
 */
export const getEvidence = (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(evidenceDir, filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ message: "Evidence file not found" });
    }
  });
};

/**
 * Generate PDF of time-in transactions
 */
export const exportPdf = asyncHandler(async (req, res) => {
  await autoTimeoutExpiredSessionsBySchedule();
  
  const { date } = req.query;
  let query = {};
  let formattedPeriod = "";
  let filename = "timein-report.pdf";

  query.isArchived = { $ne: true };

  if (date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    query.date = { $gte: startOfDay, $lte: endOfDay };
    formattedPeriod = new Date(date).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    filename = `timein-${date}.pdf`;
  } else {
    formattedPeriod = "All Transactions";
    filename = `timein-all-${new Date().toISOString().split("T")[0]}.pdf`;
  }

  const records = await TimeIn.find(query)
    .populate("student", "firstName lastName email employeeId department")
    .populate("classroom", "name location capacity")
    .sort({ date: -1, timeIn: -1 });

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  
  doc.pipe(res);
  
  doc.fontSize(20).text("Time-In Report", { align: "center" });
  doc.fontSize(12).text(`Period: ${formattedPeriod}`, { align: "center" });
  doc.moveDown(2);
  
  const tableTop = doc.y;
  const startX = 50;
  const colWidths = [60, 70, 100, 90, 80, 60];
  const rowHeight = 25;
  
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Date", startX, tableTop);
  doc.text("Time", startX + colWidths[0], tableTop);
  doc.text("Student", startX + colWidths[0] + colWidths[1], tableTop);
  doc.text("Instructor", startX + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
  doc.text("Classroom", startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
  doc.text("Status", startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], tableTop);
  
  doc.moveTo(startX, tableTop + 15)
     .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
     .stroke();
  
  doc.font("Helvetica");
  let currentY = tableTop + rowHeight;
  
  records.forEach((record) => {
    const dateStr = new Date(record.timeIn).toLocaleDateString();
    const timeStr = new Date(record.timeIn).toLocaleTimeString();
    const studentName = `${record.student?.firstName || ""} ${record.student?.lastName || ""}`.trim() || "N/A";
    const instructor = record.instructorName || "N/A";
    const classroom = record.classroom?.name || "N/A";
    const status = record.status || (record.timeOut ? 'completed' : 'active');
    
    doc.text(dateStr, startX, currentY);
    doc.text(timeStr, startX + colWidths[0], currentY);
    doc.text(studentName, startX + colWidths[0] + colWidths[1], currentY, { width: colWidths[2], ellipsis: true });
    doc.text(instructor, startX + colWidths[0] + colWidths[1] + colWidths[2], currentY);
    doc.text(classroom, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY);
    doc.text(status, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], currentY);
    
    currentY += rowHeight;
    
    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = 50;
    }
  });
  
  doc.end();
});

export const archive = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin privileges required." });
  }

  const timeInRecord = await TimeIn.findById(req.params.id);
  if (!timeInRecord) {
    return res.status(404).json({ message: "Time-in record not found" });
  }

  timeInRecord.isArchived = true;
  await timeInRecord.save();

  res.json({ message: "Time-in record archived successfully", timeInRecord });
});

export const unarchive = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin privileges required." });
  }

  const timeInRecord = await TimeIn.findById(req.params.id);
  if (!timeInRecord) {
    return res.status(404).json({ message: "Time-in record not found" });
  }

  timeInRecord.isArchived = false;
  await timeInRecord.save();

  res.json({ message: "Time-in record unarchived successfully", timeInRecord });
});

export const remove = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin privileges required." });
  }

  const timeInRecord = await TimeIn.findById(req.params.id);
  if (!timeInRecord) {
    return res.status(404).json({ message: "Time-in record not found" });
  }

  if (!timeInRecord.isArchived) {
    return res.status(400).json({ message: "Only archived records can be deleted" });
  }

  await TimeIn.findByIdAndDelete(req.params.id);
  res.json({ message: "Time-in record deleted successfully" });
});

export const getById = asyncHandler(async (req, res) => {
  await autoTimeoutExpiredSessionsBySchedule();
  
  const timeInRecord = await TimeIn.findById(req.params.id)
    .populate("student", "firstName lastName email employeeId department gender")
    .populate("classroom", "name location capacity")
    .populate("verifiedBy", "firstName lastName");

  if (!timeInRecord) {
    return res.status(404).json({ message: "Time-in record not found" });
  }

  if (req.user.role === "student" && timeInRecord.student._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Access denied" });
  }

  const obj = timeInRecord.toObject({ virtuals: true });
  const existing = String(obj.remarks || "").trim();
  const computed = deriveRemarks({ classType: obj.classType, reason: obj.reason });
  res.json({ ...obj, remarks: existing || computed });
});

export const verify = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }

    const version = requireVersion(req.body.version);
    const { status, remarks } = req.body;

    const updates = {
      status,
      verifiedBy: req.user._id,
      verifiedAt: new Date(),
    };
    if (remarks !== undefined) updates.remarks = remarks;

    const updateDoc = buildVersionedUpdateDoc(updates);
    const timeInRecord = await runVersionedUpdate(TimeIn, req.params.id, version, updateDoc);

    if (!timeInRecord) {
      return respondWithConflict(res, "TimeIn Record");
    }

    await timeInRecord.populate([
      { path: "student", select: "firstName lastName email employeeId department gender" },
      { path: "classroom", select: "name location capacity" },
      { path: "verifiedBy", select: "firstName lastName" },
    ]);

    res.json({ message: `Time-in record ${status} successfully`, timeInRecord });
  } catch (error) {
    if (isVersionError(error)) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
};

export const resetOldTimeIns = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin privileges required." });
  }

  const { hoursThreshold = 24, timeZone = "Asia/Manila" } = req.body;
  
  try {
    const now = new Date();
    const manilaNow = new Date(now.toLocaleString("en-US", { timeZone }));
    const cutoffTime = new Date(manilaNow.getTime() - (hoursThreshold * 60 * 60 * 1000));
    
    const oldRecords = await TimeIn.find({
      timeIn: { $lte: cutoffTime },
      isArchived: { $ne: true }
    });
    
    if (oldRecords.length === 0) {
      return res.json({ success: true, resetCount: 0, message: "No records older than threshold found" });
    }
    
    const result = await TimeIn.updateMany(
      {
        timeIn: { $lte: cutoffTime },
        isArchived: { $ne: true }
      },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date(),
          archivedReason: `Auto-archived after ${hoursThreshold} hours`
        }
      }
    );
    
    console.log(`✅ Auto-archived ${result.modifiedCount} old time-in records`);
    
    res.json({
      success: true,
      resetCount: result.modifiedCount,
      message: `Successfully archived ${result.modifiedCount} records older than ${hoursThreshold} hours`
    });
  } catch (error) {
    console.error("Error resetting old time-ins:", error);
    res.status(500).json({ success: false, message: "Failed to reset old time-ins", error: error.message });
  }
});

export const getAvailableClasses = asyncHandler(async (req, res) => {
  const now = req.worldTime ?? new Date();
  const requestedTime = String(req.query.time || "").trim();
  const requestedPeriod = String(req.query.period || "").trim().toUpperCase();
  const requestedTimeInput = requestedPeriod
    ? `${requestedTime} ${requestedPeriod}`.trim()
    : requestedTime;

  if (!requestedTimeInput) {
    return res.status(400).json({
      message: "Time is required. Use query params like ?time=7:30&period=AM",
    });
  }

  const targetTime = parseRequestedTimeToDate(requestedTimeInput, now);
  if (!targetTime) {
    return res.status(400).json({
      message: "Invalid time format. Use time=7:30&period=AM",
    });
  }

  const currentDay = normalizeDayName(getDayName(targetTime));
  const allClassrooms = await Classroom.find({})
    .select("name location schedules")
    .lean();

  const matchedEntries = [];

  for (const classroom of allClassrooms) {
    const matchedSchedule = getActiveScheduleForTime(
      classroom.schedules || [],
      targetTime,
    );

    if (!matchedSchedule) continue;

    const instructorName = matchedSchedule.instructor?.trim() || "";
    const instructor = instructorName
      ? await Instructor.findOne({
          name: { $regex: new RegExp(`^${instructorName}$`, "i") },
        })
          .select("name unavailable unavailableReason travelStatus travelDetails")
          .lean()
      : null;

    const teachingElsewhere = instructorName
      ? await TimeIn.findOne({
          instructorName,
          classroom: { $ne: classroom._id },
          timeOut: { $exists: false },
        })
          .populate("classroom", "name")
          .select("classroom timeIn")
          .lean()
      : null;

    const occupiedClassroom = await TimeIn.findOne({
      classroom: classroom._id,
      timeOut: { $exists: false },
    })
      .populate("student", "firstName lastName")
      .select("student timeIn instructorName")
      .lean();

    const scheduleRange = parseScheduleRange(matchedSchedule.time);
    const instructorStatus = {
      name: instructor?.name || instructorName,
      unavailable: instructor?.unavailable || false,
      unavailableReason: instructor?.unavailableReason || "",
      travelStatus: instructor?.travelStatus || "available",
      travelDetails: instructor?.travelDetails || "",
      teachingElsewhere: !!teachingElsewhere,
      activeTeachingSession: teachingElsewhere
        ? {
            classroom: teachingElsewhere.classroom?.name || "Unknown",
            timeIn: teachingElsewhere.timeIn,
          }
        : null,
    };

    const classroomStatus = {
      occupied: !!occupiedClassroom,
      occupiedBy: occupiedClassroom
        ? `${occupiedClassroom.student?.firstName || ""} ${occupiedClassroom.student?.lastName || ""}`.trim()
        : "",
      occupiedSince: occupiedClassroom?.timeIn || null,
    };

    const isAvailable =
      !!instructorName &&
      !instructorStatus.unavailable &&
      instructorStatus.travelStatus !== "on-leave" &&
      !instructorStatus.teachingElsewhere &&
      !classroomStatus.occupied;

    const statusReasons = [];
    if (!instructorName) statusReasons.push("No instructor assigned");
    if (instructorStatus.unavailable) statusReasons.push("Instructor unavailable");
    if (instructorStatus.travelStatus === "on-leave") statusReasons.push("Instructor on leave");
    if (instructorStatus.travelStatus === "on-travel") statusReasons.push("Instructor on travel");
    if (instructorStatus.teachingElsewhere) statusReasons.push("Instructor teaching elsewhere");
    if (classroomStatus.occupied) statusReasons.push("Classroom occupied");

    matchedEntries.push({
      id: `${classroom._id}-${matchedSchedule.day}-${matchedSchedule.time}-${matchedSchedule.section || ""}`,
      displayLabel: `${instructorName || "TBA"} - ${classroom.name} (${matchedSchedule.section || "N/A"} - ${matchedSchedule.subjectCode || "N/A"})`,
      available: isAvailable,
      statusReasons,
      classroom: {
        id: classroom._id,
        name: classroom.name,
        location: classroom.location,
      },
      schedule: {
        day: matchedSchedule.day,
        time: matchedSchedule.time,
        section: matchedSchedule.section || "",
        subjectCode: matchedSchedule.subjectCode || "",
        instructor: instructorName,
        scheduledStartTime: scheduleRange?.start || "",
      },
      instructorStatus,
      classroomStatus,
    });
  }

  matchedEntries.sort((a, b) => Number(b.available) - Number(a.available));

  res.json({
    currentDay,
    requestedTime: requestedTimeInput,
    total: matchedEntries.length,
    classes: matchedEntries,
  });
});
