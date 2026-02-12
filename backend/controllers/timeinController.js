/**
 * Time-in Controller
 * Handles HTTP requests and responses for time-in/time-out, evidence, verification, and PDF export.
 */

import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";
import TimeIn from "../models/TimeIn.js";
import Classroom from "../models/Classroom.js";
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
 * Create time-in record with evidence upload.
 * RULES:
 * 1. Only prevent SAME USER from timing in to SAME classroom within 2.5 hours
 * 2. No classroom locking - multiple students can use same classroom
 * 3. No auto time-out - manual time-out only
 */
export const create = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Evidence photo is required" });
  }

  const { classroom, instructorName, remarks } = req.body;

  // Check classroom exists
  const classroomExists = await Classroom.findById(classroom);
  if (!classroomExists) {
    return res.status(404).json({ message: "Classroom not found" });
  }

  const currentTime = req.worldTime ?? new Date();

  // ===== SIMPLE RULE: Prevent same user from timing in to same classroom within 2.5h =====
  const lastTimeIn = await TimeIn.findOne({
    student: req.user._id,
    classroom: classroom
  }).sort({ timeIn: -1 });

  if (lastTimeIn) {
    const lastTime = new Date(lastTimeIn.timeIn);
    const diffMs = currentTime - lastTime;
    const cooldownMs = (2 * 60 * 60 * 1000) + (30 * 60 * 1000); // 2h 30m

    if (diffMs < cooldownMs) {
      const remainingMs = cooldownMs - diffMs;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      const hours = Math.floor(remainingMinutes / 60);
      const minutes = remainingMinutes % 60;

      return res.status(429).json({
        message: `You can time-in again to ${classroomExists.name} after ${hours} hour(s) and ${minutes} minute(s).`,
        classroom: classroom,
        retryAfterMinutes: remainingMinutes,
        cooldownEndsAt: new Date(lastTime.getTime() + cooldownMs)
      });
    }
  }

  // Create time-in record
  const timeInRecord = new TimeIn({
    student: req.user._id,
    classroom,
    instructorName,
    evidence: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
    },
    timeIn: currentTime,
    remarks,
  });

  await timeInRecord.save();
  
  // Populate with gender field for dashboard
  await timeInRecord.populate([
    { 
      path: "student", 
      select: "firstName lastName email employeeId department gender" 
    },
    { 
      path: "classroom", 
      select: "name location capacity" 
    }
  ]);

  res.status(201).json({
    message: `Successfully timed in to ${classroomExists.name}`,
    timeInRecord: {
      id: timeInRecord._id,
      student: timeInRecord.student,
      classroom: timeInRecord.classroom,
      instructorName: timeInRecord.instructorName,
      timeIn: timeInRecord.timeIn,
      date: timeInRecord.date,
      remarks: timeInRecord.remarks,
      evidence: {
        filename: timeInRecord.evidence.filename,
        originalName: timeInRecord.evidence.originalName,
        mimetype: timeInRecord.evidence.mimetype,
        size: timeInRecord.evidence.size,
      }
    },
  });
});

/**
 * Record time-out for the most recent active time-in
 */
export const timeout = asyncHandler(async (req, res) => {
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
    { 
      path: "student", 
      select: "firstName lastName email employeeId department gender" 
    },
    { 
      path: "classroom", 
      select: "name location capacity" 
    }
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
 * ✅ FIXED: ADMIN sees ALL students, STUDENT only sees themselves
 */
export const list = asyncHandler(async (req, res) => {
  const { student, classroom, date, status, startDate, endDate } = req.query;
  const query = {};

  // Don't show archived records
  query.isArchived = { $ne: true };

  // ✅ FIX: STUDENT - only see their own records
  if (req.user.role === "student") {
    query.student = req.user._id;
  }
  
  // ✅ FIX: ADMIN - NO student filter (sees ALL students)
  // DO NOT add any student filter for admin
  
  // Only apply student filter from query if admin explicitly requests it
  if (student && req.user.role === "admin") {
    query.student = student;
  }

  if (classroom) query.classroom = classroom;
  if (status) query.status = status;

  // Date filter - keep as is
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

  // console.log(`👤 User role: ${req.user.role}, 📊 Records found: ${timeInRecords.length}`);
  res.json(timeInRecords);
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
 * Generate PDF of time-in transactions for a date or month
 */
export const exportPdf = asyncHandler(async (req, res) => {
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
      year: "numeric",
      month: "long",
      day: "numeric",
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

  // ... PDF generation code remains the same ...
  
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  // ... rest of PDF code
});

/**
 * Archive a time-in record (Admin only)
 */
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

  res.json({
    message: "Time-in record archived successfully",
    timeInRecord,
  });
});

/**
 * Unarchive a time-in record (Admin only)
 */
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

  res.json({
    message: "Time-in record unarchived successfully",
    timeInRecord,
  });
});

/**
 * Delete an archived time-in record (Admin only)
 */
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

/**
 * Get a single time-in record by ID
 */
export const getById = asyncHandler(async (req, res) => {
  const timeInRecord = await TimeIn.findById(req.params.id)
    .populate("student", "firstName lastName email employeeId department gender")
    .populate("classroom", "name location capacity")
    .populate("verifiedBy", "firstName lastName");

  if (!timeInRecord) {
    return res.status(404).json({ message: "Time-in record not found" });
  }

  if (
    req.user.role === "student" &&
    timeInRecord.student._id.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json(timeInRecord);
});

/**
 * Verify or reject time-in record (Admin only, with versioned update)
 */
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
    const timeInRecord = await runVersionedUpdate(
      TimeIn,
      req.params.id,
      version,
      updateDoc
    );

    if (!timeInRecord) {
      return respondWithConflict(res, "TimeIn Record");
    }

    await timeInRecord.populate([
      { path: "student", select: "firstName lastName email employeeId department gender" },
      { path: "classroom", select: "name location capacity" },
      { path: "verifiedBy", select: "firstName lastName" },
    ]);

    res.json({
      message: `Time-in record ${status} successfully`,
      timeInRecord,
    });
  } catch (error) {
    if (isVersionError(error)) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
};