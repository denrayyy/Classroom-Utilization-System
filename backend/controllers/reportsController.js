/**
 * Reports Controller
 * Handles listing, generating, sharing, commenting, and PDF export for reports.
 */

import PDFDocument from "pdfkit";
import Report from "../models/Report.js";
import ClassroomUsage from "../models/ClassroomUsage.js";
import Schedule from "../models/Schedule.js";
import Classroom from "../models/Classroom.js";
import User from "../models/User.js";
import TimeIn from "../models/TimeIn.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";
import { asyncHandler } from "../middleware/errorHandler.js";

/**
 * List reports with optional filters (type, status, dates, week, month)
 */
export const list = asyncHandler(async (req, res) => {
  const { type, status, startDate, endDate, week, month } = req.query;
  const query = {};

  if (req.user.role === "teacher") {
    query.$or = [
      { generatedBy: req.user._id },
      { "sharedWith.user": req.user._id },
    ];
  }

  if (type) query.type = type;
  if (status) query.status = status;

  if (startDate && endDate) {
    query["period.startDate"] = { $gte: new Date(startDate) };
    query["period.endDate"] = { $lte: new Date(endDate) };
  }

  if (week && type === "weekly") {
    const [year, weekNum] = week.split("-");
    const startOfYear = new Date(year, 0, 1);
    const daysToAdd = (weekNum - 1) * 7;
    const weekStart = new Date(startOfYear);
    weekStart.setDate(startOfYear.getDate() + daysToAdd - startOfYear.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    query["period.startDate"] = { $gte: weekStart };
    query["period.endDate"] = { $lte: weekEnd };
  }

  if (month && type === "monthly") {
    const [year, monthNum] = month.split("-");
    const monthStart = new Date(year, monthNum - 1, 1);
    const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);
    query["period.startDate"] = { $gte: monthStart };
    query["period.endDate"] = { $lte: monthEnd };
  }

  const reports = await Report.find(query)
    .populate("generatedBy", "firstName lastName email employeeId")
    .populate("sharedWith.user", "firstName lastName email")
    .sort({ createdAt: -1 });

  res.json(reports);
});

/**
 * Get all time-in transactions (admin), optional date filter
 */
export const getTimeInAll = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const query = {};

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

  const timeInTransactions = await TimeIn.find(query)
    .populate("student", "firstName lastName email employeeId department")
    .populate("classroom", "name location capacity")
    .populate("verifiedBy", "firstName lastName")
    .sort({ date: -1, timeIn: -1 });

  res.json(timeInTransactions || []);
});

/**
 * Get report by ID (with access check for teachers)
 */
export const getById = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id)
    .populate("generatedBy", "firstName lastName email employeeId")
    .populate("sharedWith.user", "firstName lastName email");

  if (!report) {
    return res.status(404).json({ message: "Report not found" });
  }

  if (req.user.role === "teacher") {
    const hasAccess =
      report.generatedBy._id.toString() === req.user._id.toString() ||
      report.sharedWith.some((share) => share.user._id.toString() === req.user._id.toString());
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }
  }

  res.json(report);
});

/**
 * Generate teacher report for a date range
 */
export const generateTeacher = asyncHandler(async (req, res) => {
  const { startDate, endDate, title } = req.body;
  const start = new Date(startDate);
  const end = new Date(endDate);

  const usageRecords = await ClassroomUsage.find({
    teacher: req.user._id,
    date: { $gte: start, $lte: end },
  })
    .populate("classroom", "name location capacity")
    .populate("schedule", "subject courseCode dayOfWeek startTime endTime")
    .sort({ date: 1 });

  const schedules = await Schedule.find({
    teacher: req.user._id,
    status: { $in: ["approved", "active"] },
  })
    .populate("classroom", "name location capacity")
    .sort({ dayOfWeek: 1, startTime: 1 });

  const totalClasses = usageRecords.length;
  const onTimeClasses = usageRecords.filter((r) => r.status === "on-time").length;
  const lateStartClasses = usageRecords.filter((r) => r.status === "late-start").length;
  const earlyEndClasses = usageRecords.filter((r) => r.status === "early-end").length;
  const noShowClasses = usageRecords.filter((r) => r.status === "no-show").length;
  const totalHours = usageRecords.reduce((sum, record) => {
    if (record.timeOut && record.timeIn) {
      return sum + (record.timeOut - record.timeIn) / (1000 * 60 * 60);
    }
    return sum;
  }, 0);

  const reportData = {
    teacher: {
      name: req.user.fullName,
      email: req.user.email,
      employeeId: req.user.employeeId,
      department: req.user.department,
    },
    period: { startDate: start, endDate: end },
    statistics: {
      totalClasses,
      onTimeClasses,
      lateStartClasses,
      earlyEndClasses,
      noShowClasses,
      totalHours: Math.round(totalHours * 100) / 100,
      attendanceRate: totalClasses > 0 ? Math.round((onTimeClasses / totalClasses) * 100) : 0,
    },
    usageRecords,
    schedules,
  };

  const report = new Report({
    title:
      title ||
      `Teacher Report - ${req.user.fullName} (${start.toDateString()} to ${end.toDateString()})`,
    type: "teacher",
    generatedBy: req.user._id,
    period: { startDate: start, endDate: end },
    data: reportData,
    summary: {
      totalClassrooms: new Set(usageRecords.map((r) => r.classroom._id)).size,
      totalUtilization: Math.round(totalHours * 100) / 100,
      averageUtilization:
        totalClasses > 0 ? Math.round((totalHours / totalClasses) * 100) / 100 : 0,
      underutilizedClassrooms: 0,
      conflicts: 0,
      recommendations: [],
    },
    status: "completed",
  });

  await report.save();

  res.status(201).json({
    message: "Teacher report generated successfully",
    report,
  });
});

/**
 * Generate admin utilization report
 */
export const generateAdmin = asyncHandler(async (req, res) => {
  const { startDate, endDate, title } = req.body;
  const start = new Date(startDate);
  const end = new Date(endDate);

  const utilizationSummary = await ClassroomUsage.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: "$classroom",
        totalRecords: { $sum: 1 },
        averageUtilization: { $avg: "$utilizationRate" },
        totalHours: {
          $sum: { $divide: [{ $subtract: ["$timeOut", "$timeIn"] }, 1000 * 60 * 60] },
        },
        onTimeCount: { $sum: { $cond: [{ $eq: ["$status", "on-time"] }, 1, 0] } },
        lateStartCount: { $sum: { $cond: [{ $eq: ["$status", "late-start"] }, 1, 0] } },
        earlyEndCount: { $sum: { $cond: [{ $eq: ["$status", "early-end"] }, 1, 0] } },
        noShowCount: { $sum: { $cond: [{ $eq: ["$status", "no-show"] }, 1, 0] } },
      },
    },
    {
      $lookup: {
        from: "classrooms",
        localField: "_id",
        foreignField: "_id",
        as: "classroom",
      },
    },
    { $unwind: "$classroom" },
  ]);

  const allClassrooms = await Classroom.find();
  const classroomUtilization = allClassrooms.map((classroom) => {
    const summary = utilizationSummary.find(
      (s) => s._id.toString() === classroom._id.toString()
    );
    return {
      classroom: {
        name: classroom.name,
        location: classroom.location,
        capacity: classroom.capacity,
      },
      totalRecords: summary?.totalRecords || 0,
      averageUtilization: summary ? Math.round(summary.averageUtilization * 100) / 100 : 0,
      totalHours: summary ? Math.round(summary.totalHours * 100) / 100 : 0,
      onTimeCount: summary?.onTimeCount || 0,
      lateStartCount: summary?.lateStartCount || 0,
      earlyEndCount: summary?.earlyEndCount || 0,
      noShowCount: summary?.noShowCount || 0,
      isUnderutilized: summary ? summary.averageUtilization < 50 : true,
    };
  });

  const teacherStats = await ClassroomUsage.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: "$teacher",
        totalClasses: { $sum: 1 },
        onTimeClasses: { $sum: { $cond: [{ $eq: ["$status", "on-time"] }, 1, 0] } },
        totalHours: {
          $sum: { $divide: [{ $subtract: ["$timeOut", "$timeIn"] }, 1000 * 60 * 60] },
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "teacher",
      },
    },
    { $unwind: "$teacher" },
  ]);

  const underutilizedClassrooms = classroomUtilization.filter((c) => c.isUnderutilized).length;
  const totalUtilization = classroomUtilization.reduce(
    (sum, c) => sum + c.averageUtilization,
    0
  );
  const averageUtilization =
    classroomUtilization.length > 0 ? totalUtilization / classroomUtilization.length : 0;

  const reportData = {
    period: { startDate: start, endDate: end },
    classroomUtilization,
    teacherStats,
    overallStatistics: {
      totalClassrooms: allClassrooms.length,
      totalUtilization: Math.round(totalUtilization * 100) / 100,
      averageUtilization: Math.round(averageUtilization * 100) / 100,
      underutilizedClassrooms,
      totalTeachers: teacherStats.length,
      totalClasses: teacherStats.reduce((sum, t) => sum + t.totalClasses, 0),
    },
  };

  const recommendations = [];
  if (underutilizedClassrooms > 0) {
    recommendations.push(
      `Consider reallocating ${underutilizedClassrooms} underutilized classrooms`
    );
  }
  if (averageUtilization < 70) {
    recommendations.push(
      "Overall utilization is below 70%. Consider optimizing classroom assignments"
    );
  }

  const report = new Report({
    title:
      title ||
      `Admin Utilization Report (${start.toDateString()} to ${end.toDateString()})`,
    type: "admin",
    generatedBy: req.user._id,
    period: { startDate: start, endDate: end },
    data: reportData,
    summary: {
      totalClassrooms: allClassrooms.length,
      totalUtilization: Math.round(totalUtilization * 100) / 100,
      averageUtilization: Math.round(averageUtilization * 100) / 100,
      underutilizedClassrooms,
      conflicts: 0,
      recommendations,
    },
    status: "completed",
  });

  await report.save();

  res.status(201).json({
    message: "Admin report generated successfully",
    report,
  });
});

/**
 * Generate weekly report
 */
export const generateWeekly = asyncHandler(async (req, res) => {
  const { startDate } = req.body;
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const query = { date: { $gte: start, $lte: end } };
  if (req.user.role === "teacher") {
    query.teacher = req.user._id;
  }

  const usageRecords = await ClassroomUsage.find(query)
    .populate("classroom", "name location capacity")
    .populate("teacher", "firstName lastName email employeeId")
    .populate("schedule", "subject courseCode dayOfWeek startTime endTime")
    .sort({ date: 1, timeIn: 1 });

  const dailyRecords = {};
  usageRecords.forEach((record) => {
    const day = record.date.toDateString();
    if (!dailyRecords[day]) dailyRecords[day] = [];
    dailyRecords[day].push(record);
  });

  const reportData = {
    period: { startDate: start, endDate: end },
    dailyRecords,
    summary: {
      totalClasses: usageRecords.length,
      totalHours: usageRecords.reduce((sum, record) => {
        if (record.timeOut && record.timeIn) {
          return sum + (record.timeOut - record.timeIn) / (1000 * 60 * 60);
        }
        return sum;
      }, 0),
    },
  };

  const report = new Report({
    title: `Weekly Report (${start.toDateString()} to ${end.toDateString()})`,
    type: "weekly",
    generatedBy: req.user._id,
    period: { startDate: start, endDate: end },
    data: reportData,
    status: "completed",
  });

  await report.save();

  res.status(201).json({
    message: "Weekly report generated successfully",
    report,
  });
});

/**
 * Share report with users
 */
export const share = asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  const report = await Report.findById(req.params.id);

  if (!report) {
    return res.status(404).json({ message: "Report not found" });
  }

  if (
    req.user.role === "teacher" &&
    report.generatedBy.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  const users = await User.find({ _id: { $in: userIds } });
  if (users.length !== userIds.length) {
    return res.status(400).json({ message: "Some users not found" });
  }

  const newShares = userIds.map((userId) => ({
    user: userId,
    sharedAt: new Date(),
  }));
  report.sharedWith.push(...newShares);
  await report.save();

  res.json({
    message: "Report shared successfully",
    report,
  });
});

/**
 * Delete report (teachers can only delete own)
 */
export const remove = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);

  if (!report) {
    return res.status(404).json({ message: "Report not found" });
  }

  if (
    req.user.role === "teacher" &&
    report.generatedBy.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ message: "Access denied" });
  }

  await Report.findByIdAndDelete(req.params.id);
  res.json({ message: "Report deleted successfully" });
});

/**
 * Manually trigger daily archive (Admin)
 */
export const archiveDaily = asyncHandler(async (req, res) => {
  const { archiveDailyRecords } = await import("../utils/dailyArchive.js");
  await archiveDailyRecords();
  res.json({ message: "Daily archive completed successfully" });
});

/**
 * Add or update comment on report (versioned)
 */
export const updateComment = async (req, res) => {
  try {
    const version = requireVersion(req.body.version);
    const { comment } = req.body;

    const reportExists = await Report.findById(req.params.id);
    if (!reportExists) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (
      req.user.role === "teacher" &&
      reportExists.generatedBy.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    const updates = { comment: comment || "" };
    const updateDoc = buildVersionedUpdateDoc(updates);

    const report = await runVersionedUpdate(Report, req.params.id, version, updateDoc);

    if (!report) {
      return respondWithConflict(res, "Report");
    }

    await report.populate([
      { path: "generatedBy", select: "firstName lastName email employeeId" },
      { path: "sharedWith.user", select: "firstName lastName email" },
    ]);

    res.json({
      message: "Comment updated successfully",
      report,
    });
  } catch (error) {
    if (isVersionError(error)) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Export report as PDF
 */
export const exportTimeInPdf = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate) : new Date("2000-01-01");
  const end = endDate ? new Date(endDate) : new Date();

  const records = await TimeIn.find({ date: { $gte: start, $lte: end } })
    .populate("student", "firstName lastName")
    .populate("classroom", "name")
    .sort({ date: -1, timeIn: -1 });

  const doc = new PDFDocument({ size: "Letter", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="timein-report.pdf"`);
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  let pageNumber = 1;

  // ----- HEADER -----
  const drawHeader = () => {
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#000000")
      .text("Time-In Records Report", 50, 30, { align: "center" });
    doc.fontSize(9).font("Helvetica").fillColor("#000000")
      .text(`Generated: ${new Date().toLocaleString()}`, 50, 50, { align: "right" });
    doc.moveTo(50, 65).lineTo(pageWidth - 50, 65).stroke();
  };

  // ----- FOOTER -----
  const drawFooter = () => {
    doc.fontSize(9).font("Helvetica").fillColor("#000000")
      .text(`Page ${pageNumber}`, 0, pageHeight - 65, { align: "center" });
  };

  // ----- TABLE HEADER -----
  const drawTableHeader = (y) => {
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#000000");
    doc.text("Date", 50, y);
    doc.text("Classroom", 120, y);
    doc.text("Student", 250, y);
    doc.text("Instructor", 380, y);
    doc.text("Time In", 500, y);
    doc.moveTo(50, y + 15).lineTo(pageWidth - 50, y + 15).stroke();
  };

  const columnPositions = { date: 50, classroom: 120, student: 250, instructor: 380, timeIn: 500 };
  const columnWidths = { date: 70, classroom: 120, student: 120, instructor: 100, timeIn: 60 };

  // ----- START FIRST PAGE -----
  drawHeader();
  let y = 80; // start below header
  doc.fontSize(10).font("Helvetica-Bold").text(`Total Records: ${records.length}`, 50, y);
  y += 15;
  doc.fontSize(10).font("Helvetica").text(
    `Date Range: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
    50,
    y
  );
  y += 25;
  drawTableHeader(y);
  y += 20;

  // ----- TABLE ROWS -----
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const date = r.date ? new Date(r.date).toLocaleDateString() : "N/A";
    const classroom = r.classroom?.name || "N/A";
    const student = r.student ? `${r.student.firstName} ${r.student.lastName}` : "N/A";
    const instructor = r.instructorName || "N/A";
    const timeIn = r.timeIn ? new Date(r.timeIn).toLocaleTimeString() : "N/A";

    // calculate row height
    const studentHeight = doc.heightOfString(student, { width: columnWidths.student });
    const instructorHeight = doc.heightOfString(instructor, { width: columnWidths.instructor });
    const rowHeight = Math.max(20, studentHeight, instructorHeight);

    // page break check
    if (y + rowHeight > pageHeight - 70) {
      drawFooter();
      doc.addPage();
      pageNumber++;
      drawHeader();
      y = 80;
      drawTableHeader(y);
      y += 20;
    }

    // alternating row background
    if (i % 2 === 0) {
      doc.rect(50, y - 2, pageWidth - 100, rowHeight).fillOpacity(0.05).fillAndStroke("#cccccc", "#cccccc");
      doc.fillOpacity(1);
    }

    doc.fontSize(10).font("Helvetica").fillColor("#000000");
    doc.text(date, columnPositions.date, y, { width: columnWidths.date });
    doc.text(classroom, columnPositions.classroom, y, { width: columnWidths.classroom });
    doc.text(student, columnPositions.student, y, { width: columnWidths.student });
    doc.text(instructor, columnPositions.instructor, y, { width: columnWidths.instructor });
    doc.text(timeIn, columnPositions.timeIn, y, { width: columnWidths.timeIn });

    y += rowHeight + 5;
  }

  // Footer for last page
  drawFooter();

  // ----- DIGITAL SIGNATURE PAGE -----
  doc.addPage();
  pageNumber++;
  drawHeader();
  drawFooter();

  let sigY = 100;
  doc.fontSize(14).font("Helvetica-Bold").text("Digital Signature", 50, sigY);
  doc.rect(50, sigY + 30, 220, 60).stroke();
  doc.fontSize(10).font("Helvetica").text(
    "This document was generated electronically by \nthe system.No handwritten signature is required.",
    55,
    sigY + 40
  );
  doc.text(`Authorized by: Admin System`, 55, sigY + 90);
  doc.text(`Timestamp: ${new Date().toLocaleString()}`, 55, sigY + 105);

  drawFooter();

  doc.end();
});
