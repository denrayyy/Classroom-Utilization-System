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
          autoTimedOutAt: new Date() // Add timestamp for audit trail
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
 * Create time-in record with evidence upload.
 * RULES:
 * 1. Student cannot have an active time-in in ANY classroom (must time-out first)
 * 2. Classroom cannot be occupied by other students (only one student per classroom at a time)
 * 3. Prevent SAME USER from timing in to SAME classroom within 2.5 hours
 * 4. Instructor cannot be active in multiple classrooms simultaneously
 */
export const create = asyncHandler(async (req, res) => {
  // ✅ Auto time-out expired sessions BEFORE checking for active time-ins
  await autoTimeoutExpiredSessions();
  
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

  // ===== RULE 1: Check if student has any active time-in (not timed out) =====
  const activeTimeIn = await TimeIn.findOne({
    student: req.user._id,
    timeOut: { $exists: false } // No time-out means still active
  });

  if (activeTimeIn) {
    // Get the classroom details for the active time-in
    const activeClassroom = await Classroom.findById(activeTimeIn.classroom);
    const classroomName = activeClassroom ? activeClassroom.name : "another classroom";
    
    return res.status(429).json({
      message: `You already have an active time-in at ${classroomName}. Please time-out first before timing in to another classroom.`,
      activeTimeIn: {
        id: activeTimeIn._id,
        classroom: classroomName,
        timeIn: activeTimeIn.timeIn,
        instructorName: activeTimeIn.instructorName
      }
    });
  }

  // ===== RULE 2: Check if classroom is already occupied by another student =====
  const occupiedClassroom = await TimeIn.findOne({
    classroom: classroom,
    timeOut: { $exists: false } // Active time-in in this classroom
  });

  if (occupiedClassroom) {
    // Get the student details who is currently using the classroom
    await occupiedClassroom.populate("student", "firstName lastName email");
    
    return res.status(409).json({
      message: `This classroom (${classroomExists.name}) is currently occupied by ${occupiedClassroom.student.firstName} ${occupiedClassroom.student.lastName}. Please wait until they time-out or choose another classroom.`,
      classroom: {
        id: classroomExists._id,
        name: classroomExists.name,
        location: classroomExists.location
      },
      occupiedBy: {
        id: occupiedClassroom.student._id,
        name: `${occupiedClassroom.student.firstName} ${occupiedClassroom.student.lastName}`,
        timeIn: occupiedClassroom.timeIn
      }
    });
  }

  // ===== RULE 3: Prevent same user from timing in to same classroom within 2.5h =====
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

  // ===== RULE 4: Check if instructor is already teaching in another classroom =====
  // Find if the same instructor has an active time-in in ANY classroom
  const activeInstructorTimeIn = await TimeIn.findOne({
    instructorName: instructorName,
    timeOut: { $exists: false } // Instructor is still teaching somewhere
  }).populate("classroom", "name location");

  if (activeInstructorTimeIn) {
    return res.status(409).json({
      message: `Instructor ${instructorName} is currently teaching in ${activeInstructorTimeIn.classroom.name}. They cannot be marked as present in two classrooms simultaneously.`,
      activeTeachingSession: {
        id: activeInstructorTimeIn._id,
        classroom: activeInstructorTimeIn.classroom.name,
        timeIn: activeInstructorTimeIn.timeIn,
        student: activeInstructorTimeIn.student
      }
    });
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
    message: `Successfully timed in to ${classroomExists.name} with instructor ${instructorName}`,
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
  // ✅ Auto time-out expired sessions before finding active session
  await autoTimeoutExpiredSessions();
  
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
 * Auto time-out expired sessions
 * ADMIN sees ALL students, STUDENT only sees themselves
 */
export const list = asyncHandler(async (req, res) => {
  // Auto time-out expired sessions first
  await autoTimeoutExpiredSessions();
  
  const { student, classroom, date, status, startDate, endDate } = req.query;
  const query = {};

  // Don't show archived records
  query.isArchived = { $ne: true };

  // STUDENT - only see their own records
  if (req.user.role === "student") {
    query.student = req.user._id;
  }
  
  // Only apply student filter from query if admin explicitly requests it
  if (student && req.user.role === "admin") {
    query.student = student;
  }

  if (classroom) query.classroom = classroom;
  
  // Only filter by status if provided
  if (status) {
    query.status = status;
  }

  // Date filter
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
  // ✅ Auto time-out expired sessions before generating report
  await autoTimeoutExpiredSessions();
  
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

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  
  doc.pipe(res);
  
  // Header
  doc.fontSize(20).text("Time-In Report", { align: "center" });
  doc.fontSize(12).text(`Period: ${formattedPeriod}`, { align: "center" });
  doc.moveDown();
  doc.text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(2);
  
  // Table headers
  const tableTop = doc.y;
  const startX = 50;
  const colWidths = [80, 100, 80, 100, 80];
  const rowHeight = 25;
  
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("Date", startX, tableTop);
  doc.text("Time", startX + colWidths[0], tableTop);
  doc.text("Student", startX + colWidths[0] + colWidths[1], tableTop);
  doc.text("Instructor", startX + colWidths[0] + colWidths[1] + colWidths[2], tableTop);
  doc.text("Classroom", startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableTop);
  
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
    
    doc.text(dateStr, startX, currentY);
    doc.text(timeStr, startX + colWidths[0], currentY);
    doc.text(studentName, startX + colWidths[0] + colWidths[1], currentY, { width: colWidths[2], ellipsis: true });
    doc.text(instructor, startX + colWidths[0] + colWidths[1] + colWidths[2], currentY);
    doc.text(classroom, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY);
    
    currentY += rowHeight;
    
    if (currentY > doc.page.height - 100) {
      doc.addPage();
      currentY = 50;
    }
  });
  
  doc.end();
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
  // ✅ Auto time-out expired sessions before fetching record
  await autoTimeoutExpiredSessions();
  
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

/**
 * Reset old time-ins (Admin only)
 * Archives time-in records older than specified hours
 */
export const resetOldTimeIns = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied. Admin privileges required." });
  }

  const { hoursThreshold = 24, timeZone = "Asia/Manila" } = req.body;
  
  try {
    // Calculate cutoff time based on Manila timezone
    const now = new Date();
    const manilaNow = new Date(now.toLocaleString("en-US", { timeZone }));
    const cutoffTime = new Date(manilaNow.getTime() - (hoursThreshold * 60 * 60 * 1000));
    
    // Find records older than threshold that are not yet archived
    const oldRecords = await TimeIn.find({
      timeIn: { $lte: cutoffTime },
      isArchived: { $ne: true }
    });
    
    if (oldRecords.length === 0) {
      return res.json({
        success: true,
        resetCount: 0,
        message: "No records older than threshold found"
      });
    }
    
    // Archive old records
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
    
    console.log(`✅ Auto-archived ${result.modifiedCount} old time-in records (older than ${hoursThreshold} hours)`);
    
    res.json({
      success: true,
      resetCount: result.modifiedCount,
      message: `Successfully archived ${result.modifiedCount} records older than ${hoursThreshold} hours`
    });
  } catch (error) {
    console.error("Error resetting old time-ins:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset old time-ins",
      error: error.message
    });
  }
});