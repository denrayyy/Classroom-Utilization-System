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
export const exportPdf = asyncHandler(async (req, res) => {
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

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="report-${report._id}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).text(report.title, { align: "center" });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Report Type: ${report.type.toUpperCase()}`, { align: "left" });
  doc.text(
    `Generated By: ${report.generatedBy.firstName} ${report.generatedBy.lastName}`,
    { align: "left" }
  );
  doc.text(
    `Generated On: ${report.createdAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    { align: "left" }
  );
  doc.text(
    `Period: ${new Date(report.period.startDate).toLocaleDateString()} - ${new Date(report.period.endDate).toLocaleDateString()}`,
    { align: "left" }
  );
  doc.moveDown();

  if (report.comment) {
    doc.fontSize(14).text("Comments:", { underline: true });
    doc.fontSize(12).text(report.comment, { align: "left" });
    doc.moveDown();
  }

  if (report.data && report.data.statistics) {
    doc.fontSize(14).text("Statistics:", { underline: true });
    doc.fontSize(12);
    doc.text(`Total Records: ${report.data.statistics.totalRecords || 0}`);
    doc.text(`Verified Records: ${report.data.statistics.verifiedRecords || 0}`);
    doc.text(`Pending Records: ${report.data.statistics.pendingRecords || 0}`);
    if (report.data.statistics.verificationRate !== undefined) {
      doc.text(`Verification Rate: ${report.data.statistics.verificationRate}%`);
    }
    doc.moveDown();
  }

  if (report.summary) {
    doc.fontSize(14).text("Summary:", { underline: true });
    doc.fontSize(12);
    doc.text(`Total Classrooms: ${report.summary.totalClassrooms || 0}`);
    doc.text(`Total Utilization: ${report.summary.totalUtilization || 0}`);
    if (report.summary.averageUtilization !== undefined) {
      doc.text(`Average Utilization: ${report.summary.averageUtilization}%`);
    }
    doc.moveDown();
  }

  if (report.data && report.data.records && report.data.records.length > 0) {
    doc.fontSize(14).text("Records:", { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const itemHeight = 20;
    let y = tableTop;

    doc.fontSize(10);
    doc.text("Student", 50, y);
    doc.text("Classroom", 150, y);
    doc.text("Instructor", 250, y);
    doc.text("Time In", 350, y);
    doc.text("Status", 450, y);
    y += itemHeight;

    const recordsToShow = report.data.records.slice(0, 50);
    recordsToShow.forEach((record) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      const studentName = record.student
        ? `${record.student.firstName} ${record.student.lastName}`
        : "N/A";
      const classroomName = record.classroom ? record.classroom.name : "N/A";
      const timeIn = record.timeIn ? new Date(record.timeIn).toLocaleString() : "N/A";

      doc.text(studentName.substring(0, 20), 50, y);
      doc.text(classroomName.substring(0, 15), 150, y);
      doc.text((record.instructorName || "N/A").substring(0, 15), 250, y);
      doc.text(timeIn.substring(0, 15), 350, y);
      doc.text(record.status || "N/A", 450, y);
      y += itemHeight;
    });

    if (report.data.records.length > 50) {
      doc.moveDown();
      doc.text(`... and ${report.data.records.length - 50} more records`, {
        align: "center",
        italic: true,
      });
    }
  }

  if (
    report.summary &&
    report.summary.recommendations &&
    report.summary.recommendations.length > 0
  ) {
    doc.addPage();
    doc.fontSize(14).text("Recommendations:", { underline: true });
    doc.fontSize(12);
    report.summary.recommendations.forEach((rec, index) => {
      doc.text(`${index + 1}. ${rec}`, { indent: 20 });
    });
  }

  doc.end();
});
