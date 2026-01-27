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
 * Expects route-level validation and multer upload to have run first.
 */
// Create time-in record with classroom conflict prevention and 7-8 AM restriction
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

  // Enforce allowed time-in hours: 7:00 AM - 8:00 AM
  const hour = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  // const currentTotalMinutes = hour * 60 + minutes;
  // const startMinutes = 7 * 60; // 7:00 AM
  // const endMinutes = 18 * 60;   // 8:00 AM

  if (hour < 7 || hour >= 20) {
    return res.status(400).json({
      message: "Time-in is only allowed between 7:00 AM and 8:00 AM",
    });
  }

  // Check if another instructor is currently using the classroom
  const classroomInUse = await TimeIn.findOne({
    classroom,
    instructorName: { $ne: instructorName }, // exclude self
    timeOut: { $exists: false },             // still active
  });

  if (classroomInUse) {
    return res.status(409).json({
      message: "Classroom is currently in use by another instructor",
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
  await timeInRecord.populate("student", "firstName lastName email employeeId department");
  await timeInRecord.populate("classroom", "name location capacity");

  res.status(201).json({
    message: "Time-in successful",
    timeInRecord: {
      id: timeInRecord._id,
      student: timeInRecord.student,
      classroom: timeInRecord.classroom,
      instructorName: timeInRecord.instructorName,
      timeIn: timeInRecord.timeIn,
      remarks: timeInRecord.remarks,
      evidence: {
        filename: timeInRecord.evidence.filename,
        originalName: timeInRecord.evidence.originalName,
        mimetype: timeInRecord.evidence.mimetype,
        size: timeInRecord.evidence.size,
      },
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
  await timeInRecord.save();

  await timeInRecord.populate("student", "firstName lastName email employeeId department");
  await timeInRecord.populate("classroom", "name location capacity");

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
 */
export const list = asyncHandler(async (req, res) => {
  const { student, classroom, date, status, startDate, endDate } = req.query;
  const query = {};

  if (req.user.role === "student") {
    query.student = req.user._id;
  }

  if (student) query.student = student;
  if (classroom) query.classroom = classroom;
  if (status) query.status = status;

  if (date) {
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD format." });
    }
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    query.date = { $gte: startOfDay, $lte: endOfDay };
  }

  if (startDate && endDate) {
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD format." });
    }
    query.date = { $gte: parsedStartDate, $lte: parsedEndDate };
  }

  const timeInRecords = await TimeIn.find(query)
    .populate("student", "firstName lastName email employeeId department")
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
  const { date } = req.query;
  let query = {};
  let formattedPeriod = "";
  let filename = "timein-report.pdf";

  if (date) {
    const dateParts = date.split("-");
    const isMonthStart = date.endsWith("-01");

    if (isMonthStart && dateParts.length === 3) {
      const [year, month] = date.split("-");
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);
      query.date = { $gte: monthStart, $lte: monthEnd };
      formattedPeriod = new Date(monthStart).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });
      filename = `timein-${year}-${month}.pdf`;
    } else {
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
    }
  } else {
    formattedPeriod = "All Transactions";
    filename = `timein-all-${new Date().toISOString().split("T")[0]}.pdf`;
  }

  const records = await TimeIn.find(query)
    .populate("student", "firstName lastName email employeeId department")
    .populate("classroom", "name location capacity")
    .sort({ date: -1, timeIn: -1 });

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  let pageNumber = 1;

  const signatureName = process.env.PDF_SIGNATURE_NAME || "Authorized Signatory";
  const signatureTitle = process.env.PDF_SIGNATURE_TITLE || "Administrator";

  const addHeader = () => {
    doc.fontSize(16).text("Classroom Utilization System", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(12).text("Time-in Transactions Report", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(10).text(`Period: ${formattedPeriod || "All Transactions"}`, { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cccccc").stroke().strokeColor("#000");
    doc.moveDown(0.6);
  };

  const addFooter = () => {
    const bottom = (doc.page?.height || 842) - 50;
    doc.fontSize(9).fillColor("#666");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 40, bottom, { width: 300 });
    doc.text(`Page ${pageNumber}`, 40, bottom, { width: 515, align: "right" });
    doc.fillColor("#000");
  };

  const addSignature = () => {
    doc.moveDown(1.5);
    doc.text("Prepared by:", { align: "left" });
    doc.moveDown(2);
    doc.text("__________________________", { align: "left" });
    doc.text(signatureName, { align: "left" });
    doc.text(signatureTitle, { align: "left" });
  };

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  addHeader();
  doc.fontSize(11).text(`Total Transactions: ${records.length}`, { align: "left" }).moveDown(0.5);

  const col = (x) => 40 + x;
  doc.font("Helvetica-Bold").fontSize(10);
  doc.text("Date", col(0), doc.y);
  doc.text("Time", col(60));
  doc.text("Student", col(110));
  doc.text("Instructor", col(250));
  doc.text("Classroom", col(370));
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cccccc").stroke().strokeColor("#000");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9);

  if (records.length === 0) {
    doc.text("No transactions found for the selected period.");
    addSignature();
    addFooter();
    doc.end();
    return;
  }

  doc.on("pageAdded", () => {
    pageNumber += 1;
    addHeader();
  });

  records.forEach((r) => {
    if (doc.y > 700) {
      doc.addPage();
    }
    const dateStr = r.date
      ? new Date(r.date).toLocaleDateString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "2-digit",
        })
      : "—";
    const timeStr = r.timeIn
      ? new Date(r.timeIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : "—";
    const studentName = r.student ? `${r.student.firstName} ${r.student.lastName}` : "—";
    const instructor = r.instructorName || "—";
    const classroomName = r.classroom ? r.classroom.name : "—";
    const y = doc.y;
    doc.text(dateStr, col(0), y, { width: 50 });
    doc.text(timeStr, col(60), y, { width: 40 });
    doc.text(studentName, col(110), y, { width: 135 });
    doc.text(instructor, col(250), y, { width: 110 });
    doc.text(classroomName, col(370), y, { width: 130 });
    doc.moveDown(0.4);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#f0f0f0").stroke().strokeColor("#000");
  });

  addSignature();
  addFooter();
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
  const timeInRecord = await TimeIn.findById(req.params.id)
    .populate("student", "firstName lastName email employeeId department")
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
      { path: "student", select: "firstName lastName email employeeId department" },
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
