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
  const {
    type,
    status,
    startDate,
    endDate,
    week,
    month,
    page = 1,
    limit = 10
  } = req.query;
  
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

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const [reports, total] = await Promise.all([
    Report.find(query)
      .populate("generatedBy", "firstName lastName email employeeId")
      .populate("sharedWith.user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Report.countDocuments(query)
  ]);

  res.json({
    reports,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  });
});

/**
 * Get all time-in transactions with pagination and filters
 */
export const getTimeInAll = asyncHandler(async (req, res) => {
  const {
    date,
    month,
    studentName,
    instructorName,
    classroom,
    page = 1,
    limit = 10,
    sortBy = "date",
    sortOrder = "desc"
  } = req.query;

  const query = {};

  // Date filter
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

  // Month filter
  if (month) {
    const [year, monthNum] = month.split("-");
    const monthStart = new Date(Number(year), Number(monthNum) - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(Number(year), Number(monthNum), 0, 23, 59, 59, 999);
    query.date = { $gte: monthStart, $lte: monthEnd };
  }

  // Classroom filter
  if (classroom) {
    query.classroom = classroom;
  }

  // Build search conditions for student/instructor
  if (studentName || instructorName) {
    query.$or = [];
    
    if (studentName) {
      query.$or.push({
        $expr: {
          $regexMatch: {
            input: { $concat: ["$student.firstName", " ", "$student.lastName"] },
            regex: studentName,
            options: "i"
          }
        }
      });
    }
    
    if (instructorName) {
      query.$or.push({
        instructorName: { $regex: instructorName, $options: "i" }
      });
    }
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Build sort
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [timeInTransactions, total] = await Promise.all([
    TimeIn.find(query)
      .populate("student", "firstName lastName email employeeId department")
      .populate("classroom", "name location capacity")
      .populate("verifiedBy", "firstName lastName")
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    TimeIn.countDocuments(query)
  ]);

  res.json({
    data: timeInTransactions,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    }
  });
});

/**
 * Get report by ID (with access check for teachers)
 */
export const getById = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id)
    .populate("generatedBy", "firstName lastName email employeeId")
    .populate("sharedWith.user", "firstName lastName email")
    .lean();

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

  const [usageRecords, schedules] = await Promise.all([
    ClassroomUsage.find({
      teacher: req.user._id,
      date: { $gte: start, $lte: end },
    })
      .populate("classroom", "name location capacity")
      .populate("schedule", "subject courseCode dayOfWeek startTime endTime")
      .sort({ date: 1 })
      .lean(),
    Schedule.find({
      teacher: req.user._id,
      status: { $in: ["approved", "active"] },
    })
      .populate("classroom", "name location capacity")
      .sort({ dayOfWeek: 1, startTime: 1 })
      .lean()
  ]);

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

  const [utilizationSummary, allClassrooms, teacherStats] = await Promise.all([
    ClassroomUsage.aggregate([
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
    ]),
    Classroom.find().lean(),
    ClassroomUsage.aggregate([
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
    ])
  ]);

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
    .sort({ date: 1, timeIn: 1 })
    .lean();

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

  // Prevent duplicate shares
  const existingUserIds = report.sharedWith.map(s => s.user.toString());
  const newUserIds = userIds.filter(id => !existingUserIds.includes(id));

  const newShares = newUserIds.map((userId) => ({
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
export const updateComment = asyncHandler(async (req, res) => {
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
});

/**
 * Export time-in transactions as PDF - receives pre-filtered data from frontend
 * Features: Professional header, footer, digital signature, and clean layout
 */
export const exportTimeInPdf = asyncHandler(async (req, res) => {
  const { 
    transactions,
    month, 
    searchQuery, 
    instructorFilter, 
    classroomFilter 
  } = req.body;

  // Validate transactions
  if (!transactions || !Array.isArray(transactions)) {
    throw new Error("No transaction data provided. Please apply filters and try again.");
  }

  const records = transactions;
  
  // ============ PDF INITIALIZATION ============
  const doc = new PDFDocument({ 
    size: "A4", 
    margin: 50,
    info: {
      Title: 'Time-In Transactions Report',
      Author: `${req.user?.firstName || ''} ${req.user?.lastName || ''}`,
      Subject: 'Classroom Utilization System',
      Creator: 'ClaUSys',
    }
  });
  
  // Generate filename
  let filename = "timein-transactions";
  if (month) filename += `-${month}`;
  if (searchQuery) filename += `-search`;
  if (instructorFilter) filename += `-${instructorFilter.replace(/\s+/g, '-')}`;
  if (classroomFilter) filename += `-${classroomFilter.replace(/\s+/g, '-')}`;
  filename += `.pdf`;
  
  // Set headers
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  // ============ CONSTANTS ============
  const PAGE_WIDTH = doc.page.width;
  const PAGE_HEIGHT = doc.page.height;
  const MARGIN = 50;
  const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
  const ROWS_PER_PAGE = 25; // Increased for better space usage
  
  // ============ PAGE ELEMENTS ============
  
  /**
   * Draw page header (same on all pages)
   */
  const drawHeader = () => {
    const y = 30;
    
    // Top decorative line
    doc.moveTo(MARGIN, y + 18)
       .lineTo(PAGE_WIDTH - MARGIN, y + 18)
       .lineWidth(2)
       .strokeColor("#2e3a43")
       .stroke();
    
    // System name - left
    doc.fontSize(16)
       .font("Helvetica-Bold")
       .fillColor("#1c2529")
       .text("ClaUSys", MARGIN, y);
    
    // Report title - right
    doc.fontSize(14)
       .font("Helvetica-Bold")
       .fillColor("#2e3a43")
       .text("TIME-IN TRANSACTIONS", 
             PAGE_WIDTH - MARGIN - 200, y, 
             { width: 200, align: "right" });
    
    // Subtitle - left
    doc.fontSize(9)
       .font("Helvetica")
       .fillColor("#5a7480")
       .text("Classroom Utilization System", MARGIN, y + 25);
    
    // Generated date - right
    doc.fontSize(9)
       .fillColor("#5a7480")
       .text(`Generated: ${new Date().toLocaleString()}`, 
             PAGE_WIDTH - MARGIN - 200, y + 25, 
             { width: 200, align: "right" });
    
    // Separator line
    doc.moveTo(MARGIN, y + 45)
       .lineTo(PAGE_WIDTH - MARGIN, y + 45)
       .lineWidth(1)
       .strokeColor("#e1e5e9")
       .stroke();
    
    return y + 55;
  };

  /**
   * Draw page footer with page number and signature
   */
  const drawFooter = (pageNum, totalPages) => {
    const y = PAGE_HEIGHT - 60;
    
    // Top border
    doc.moveTo(MARGIN, y - 15)
       .lineTo(PAGE_WIDTH - MARGIN, y - 10)
       .lineWidth(0.5)
       .strokeColor("#e1e5e9")
       .stroke();
    
    // Generated by - left
    doc.fontSize(8)
       .font("Helvetica")
       .fillColor("#5a7480")
       .text(
         `Generated by: ${req.user?.firstName || ''} ${req.user?.lastName || ''}`,
         MARGIN, y
       );
    
    // Page number - right
    doc.fontSize(8)
       .font("Helvetica")
       .fillColor("#5a7480")
       .text(
         `Page ${pageNum} of ${totalPages}`,
         PAGE_WIDTH - MARGIN - 100, y,
         { width: 100, align: "right" }
       );
  };

  /**
   * Draw filter summary (compact version)
   */
  const drawFilters = (startY) => {
    const filters = [];
    if (month) {
      const monthDate = new Date(month + "-01");
      const monthName = monthDate.toLocaleDateString("en-US", { 
        year: "numeric", month: "long" 
      });
      filters.push(`📅 Month: ${monthName}`);
    }
    if (searchQuery) filters.push(`🔍 Search: "${searchQuery}"`);
    if (instructorFilter) filters.push(`👨‍🏫 Instructor: ${instructorFilter}`);
    if (classroomFilter) filters.push(`🏛️ Classroom: ${classroomFilter}`);
    
    if (filters.length === 0) return startY;
    
    // Filter box
    doc.rect(MARGIN, startY, CONTENT_WIDTH, 35)
       .fillOpacity(0.02)
       .fill("#2e3a43")
       .fillOpacity(1);
    
    doc.fontSize(9)
       .font("Helvetica-Bold")
       .fillColor("#1c2529")
       .text("FILTERS:", MARGIN + 10, startY + 11);
    
    doc.fontSize(9)
       .font("Helvetica")
       .fillColor("#2e3a43")
       .text(filters.join("  •  "), MARGIN + 70, startY + 11, 
             { width: CONTENT_WIDTH - 80, ellipsis: true });
    
    return startY + 45;
  };

  /**
   * Draw table header
   */
  const drawTableHeader = (y) => {
    // Header background
    doc.rect(MARGIN, y - 5, CONTENT_WIDTH, 25)
       .fillOpacity(0.1)
       .fill("#2e3a43")
       .fillOpacity(1);
    
    doc.fontSize(10)
       .font("Helvetica-Bold")
       .fillColor("#1c2529");
    
    // Column positions
    const cols = {
      date: MARGIN,
      time: MARGIN + 70,
      student: MARGIN + 130,
      instructor: MARGIN + 260,
      classroom: MARGIN + 360
    };
    
    doc.text("Date", cols.date, y);
    doc.text("Time", cols.time, y);
    doc.text("Student", cols.student, y);
    doc.text("Instructor", cols.instructor, y);
    doc.text("Classroom", cols.classroom, y);
    
    // Underline
    doc.moveTo(MARGIN, y + 20)
       .lineTo(PAGE_WIDTH - MARGIN, y + 20)
       .strokeColor("#2e3a43")
       .stroke();
    
    return { y: y + 30, cols };
  };

  /**
   * Draw summary statistics
   */
  const drawSummary = (y) => {
    // Calculate stats
    const uniqueStudents = new Set(records.map(r => r.student?.email).filter(Boolean)).size;
    const uniqueInstructors = new Set(records.map(r => r.instructorName).filter(Boolean)).size;
    const uniqueClassrooms = new Set(records.map(r => r.classroom?.name).filter(Boolean)).size;
    
    // Summary box
    doc.rect(MARGIN, y, CONTENT_WIDTH, 155)
       .lineWidth(0.5)
       .strokeColor("#e1e5e9")
       .stroke();
    
    doc.fontSize(14)
       .font("Helvetica-Bold")
       .fillColor("#1c2529")
       .text("SUMMARY", MARGIN + 15, y + 15);
    
    // Stats in 3 columns
    const colWidth = CONTENT_WIDTH / 3;
    let statsY = y + 50;
    
    // Row 1
    const stats = [
      { label: "Total Records", value: records.length },
      { label: "Unique Students", value: uniqueStudents },
      { label: "Unique Instructors", value: uniqueInstructors }
    ];
    
    stats.forEach((stat, i) => {
      const x = MARGIN + 15 + (i * colWidth);
      doc.fontSize(10)
         .font("Helvetica-Bold")
         .fillColor("#2e3a43")
         .text(stat.label, x, statsY);
      doc.fontSize(20)
         .font("Helvetica-Bold")
         .fillColor("#1c2529")
         .text(stat.value.toString(), x, statsY + 20);
    });
    
    // Row 2 - Unique Classrooms
    doc.fontSize(10)
       .font("Helvetica-Bold")
       .fillColor("#2e3a43")
       .text("Unique Classrooms", MARGIN + 15, statsY + 60);
    doc.fontSize(20)
       .font("Helvetica-Bold")
       .fillColor("#1c2529")
       .text(uniqueClassrooms.toString(), MARGIN + 15, statsY + 80);
    
    // Digital signature
    const sigY = y + 220 ;
    doc.moveTo(MARGIN + 50, sigY)
       .lineTo(MARGIN + 200, sigY)
       .lineWidth(0.5)
       .strokeColor("#2e3a43")
       .stroke();
    
    doc.fontSize(9)
       .font("Helvetica")
       .fillColor("#5a7480")
       .text(
         `Digitally signed by: ${req.user?.firstName || ''} ${req.user?.lastName || ''}`,
         MARGIN + 50, sigY + 10
       );
    
    doc.fontSize(7)
       .font("Helvetica-Oblique")
       .fillColor("#5a7480")
       .text(
         "System-generated report • Valid without signature",
         MARGIN + 50, sigY + 25,
         { width: 300 }
       );
    
    return y + 260 ;
  };

  // ============ BUILD PDF ============
  
  // Calculate total pages
  let currentPage = 1;
  
  // ---------- PAGE 1: HEADER + FILTERS + TABLE ROWS ----------
  let y = drawHeader();
  
  // Total records count
  doc.fontSize(14)
     .font("Helvetica-Bold")
     .fillColor("#1c2529")
     .text(`TOTAL RECORDS: ${records.length}`, MARGIN, y);
  y += 35;
  
  // Filters (if any)
  y = drawFilters(y);
  
  // Table header
  const { y: tableY, cols } = drawTableHeader(y);
  y = tableY;
  
  // Table rows
  let rowCount = 0;
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    // Check if we need a new page
    if (y > PAGE_HEIGHT - 80) {
      // Add footer to current page
      drawFooter(currentPage, Math.ceil(records.length / ROWS_PER_PAGE) + 1);
      
      // New page
      doc.addPage();
      currentPage++;
      
      // Draw header on new page
      y = drawHeader();
      
      // Redraw table header
      const header = drawTableHeader(y);
      y = header.y;
      Object.assign(cols, header.cols);
      
      rowCount = 0;
    }
    
    // Alternate row background
    if (i % 2 === 0) {
      doc.rect(MARGIN, y - 5, CONTENT_WIDTH, 22)
         .fillOpacity(0.02)
         .fill("#2e3a43")
         .fillOpacity(1);
    }
    
    // Row data
    const date = record.date 
      ? new Date(record.date).toLocaleDateString("en-US", {
          month: "2-digit", day: "2-digit", year: "2-digit"
        })
      : "—";
    
    const time = record.timeIn
      ? new Date(record.timeIn).toLocaleTimeString("en-US", {
          hour: "2-digit", minute: "2-digit", hour12: true
        })
      : "—";
    
    const student = record.student
      ? `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim()
      : "—";
    
    const instructor = record.instructorName || "—";
    const classroom = record.classroom?.name || "—";
    
    doc.fontSize(9)
       .font("Helvetica")
       .fillColor("#1c2529");
    
    doc.text(date, cols.date, y, { width: 60 });
    doc.text(time, cols.time, y, { width: 50 });
    doc.text(student, cols.student, y, { width: 120, ellipsis: true });
    doc.text(instructor, cols.instructor, y, { width: 90, ellipsis: true });
    doc.text(classroom, cols.classroom, y, { width: 120, ellipsis: true });
    
    y += 22;
    rowCount++;
  }
  
  // Add footer to last table page
  const totalTablePages = Math.ceil(records.length / ROWS_PER_PAGE);
  drawFooter(currentPage, totalTablePages + 1);
  
  // ---------- SUMMARY PAGE ----------
  doc.addPage();
  currentPage++;
  
  // Header on summary page
  drawHeader();
  
  // Summary section
  drawSummary(130);
  
  // Footer on summary page
  drawFooter(currentPage, totalTablePages + 1);
  
  // Finalize
  doc.end();
});