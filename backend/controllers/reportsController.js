/**
 * Reports Controller
 * Handles listing, generating, sharing, commenting, PDF export, and DOCX export for reports.
 */

import PDFDocument from "pdfkit";
import crypto from 'crypto';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType } from "docx";
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
 * List reports with optional filters
 */
export const list = asyncHandler(async (req, res) => {
  const { type, status, startDate, endDate, week, month, page = 1, limit = 10 } = req.query;
  const query = {};
  if (req.user.role === "teacher") {
    query.$or = [{ generatedBy: req.user._id }, { "sharedWith.user": req.user._id }];
  }
  if (type) query.type = type;
  if (status) query.status = status;
  if (startDate && endDate) {
    query["period.startDate"] = { $gte: new Date(startDate) };
    query["period.endDate"] = { $lte: new Date(endDate) };
  }
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const [reports, total] = await Promise.all([
    Report.find(query).populate("generatedBy", "firstName lastName email employeeId").populate("sharedWith.user", "firstName lastName email").sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    Report.countDocuments(query)
  ]);
  res.json({ reports, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
});

/**
 * Get all time-in transactions
 */
export const getTimeInAll = asyncHandler(async (req, res) => {
  const { date, month, studentName, instructorName, classroom, page = 1, limit = 1000, sortBy = "date", sortOrder = "desc" } = req.query;
  const query = {};
  if (date) {
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);
    query.date = { $gte: startOfDay, $lte: endOfDay };
  }
  if (month) {
    const [year, monthNum] = month.split("-");
    query.date = { $gte: new Date(Number(year), Number(monthNum) - 1, 1), $lte: new Date(Number(year), Number(monthNum), 0, 23, 59, 59, 999) };
  }
  if (classroom) query.classroom = classroom;
  const pageNum = parseInt(page); const limitNum = parseInt(limit);
  const [timeInTransactions, total] = await Promise.all([
    TimeIn.find(query).populate("student", "firstName lastName email employeeId department").populate("classroom", "name location capacity").populate("verifiedBy", "firstName lastName").sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    TimeIn.countDocuments(query)
  ]);
  res.json({ data: timeInTransactions, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
});

/**
 * Get report by ID
 */
export const getById = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id).populate("generatedBy", "firstName lastName email employeeId").populate("sharedWith.user", "firstName lastName email").lean();
  if (!report) return res.status(404).json({ message: "Report not found" });
  res.json(report);
});

/**
 * Generate teacher report
 */
export const generateTeacher = asyncHandler(async (req, res) => {
  const { startDate, endDate, title } = req.body;
  const start = new Date(startDate); const end = new Date(endDate);
  const usageRecords = await ClassroomUsage.find({ teacher: req.user._id, date: { $gte: start, $lte: end } }).populate("classroom", "name location capacity").sort({ date: 1 }).lean();
  const totalClasses = usageRecords.length;
  const report = new Report({ title: title || `Teacher Report (${start.toDateString()} to ${end.toDateString()})`, type: "teacher", generatedBy: req.user._id, period: { startDate: start, endDate: end }, data: { usageRecords, totalClasses }, status: "completed" });
  await report.save();
  res.status(201).json({ message: "Teacher report generated", report });
});

/**
 * Generate admin report
 */
export const generateAdmin = asyncHandler(async (req, res) => {
  const { startDate, endDate, title } = req.body;
  const start = new Date(startDate); const end = new Date(endDate);
  const usageRecords = await ClassroomUsage.find({ date: { $gte: start, $lte: end } }).populate("classroom", "name location capacity").sort({ date: 1 }).lean();
  const report = new Report({ title: title || `Admin Report (${start.toDateString()} to ${end.toDateString()})`, type: "admin", generatedBy: req.user._id, period: { startDate: start, endDate: end }, data: { usageRecords }, status: "completed" });
  await report.save();
  res.status(201).json({ message: "Admin report generated", report });
});

/**
 * Generate weekly report
 */
export const generateWeekly = asyncHandler(async (req, res) => {
  const { startDate } = req.body;
  const start = new Date(startDate); const end = new Date(start); end.setDate(end.getDate() + 6);
  const usageRecords = await ClassroomUsage.find({ date: { $gte: start, $lte: end } }).populate("classroom", "name location capacity").sort({ date: 1 }).lean();
  const report = new Report({ title: `Weekly Report (${start.toDateString()} to ${end.toDateString()})`, type: "weekly", generatedBy: req.user._id, period: { startDate: start, endDate: end }, data: { usageRecords }, status: "completed" });
  await report.save();
  res.status(201).json({ message: "Weekly report generated", report });
});

/**
 * Share report
 */
export const share = asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  const newShares = userIds.filter(id => !report.sharedWith.some(s => s.user.toString() === id)).map(userId => ({ user: userId, sharedAt: new Date() }));
  report.sharedWith.push(...newShares);
  await report.save();
  res.json({ message: "Report shared", report });
});

/**
 * Delete report
 */
export const remove = asyncHandler(async (req, res) => {
  const report = await Report.findById(req.params.id);
  if (!report) return res.status(404).json({ message: "Report not found" });
  await Report.findByIdAndDelete(req.params.id);
  res.json({ message: "Report deleted" });
});

/**
 * Archive daily
 */
export const archiveDaily = asyncHandler(async (req, res) => {
  const { archiveDailyRecords } = await import("../utils/dailyArchive.js");
  await archiveDailyRecords();
  res.json({ message: "Daily archive completed" });
});

/**
 * Update comment
 */
export const updateComment = asyncHandler(async (req, res) => {
  const version = requireVersion(req.body.version);
  const { comment } = req.body;
  const report = await runVersionedUpdate(Report, req.params.id, version, buildVersionedUpdateDoc({ comment: comment || "" }));
  if (!report) return respondWithConflict(res, "Report");
  await report.populate([{ path: "generatedBy", select: "firstName lastName email employeeId" }, { path: "sharedWith.user", select: "firstName lastName email" }]);
  res.json({ message: "Comment updated", report });
});

/**
 * Export time-in as PDF
 */
export const exportTimeInPdf = asyncHandler(async (req, res) => {
  const { transactions, month, searchQuery, instructorFilter, classroomFilter } = req.body;
  if (!transactions || !Array.isArray(transactions)) throw new Error("No transaction data");
  const records = transactions;
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  let filename = "timein-transactions";
  if (month) filename += `-${month}`;
  filename += `.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.fontSize(20).text("Time-In Report", { align: "center" });
  doc.moveDown();
  doc.fontSize(10);
  records.forEach((record, i) => {
    const date = record.date ? new Date(record.date).toLocaleDateString() : "—";
    const time = record.timeIn ? new Date(record.timeIn).toLocaleTimeString() : "—";
    const student = record.student ? `${record.student.firstName || ''} ${record.student.lastName || ''}`.trim() : "—";
    const instructor = record.instructorName || "—";
    const classroom = record.classroom?.name || "—";
    doc.text(`${date} | ${time} | ${student} | ${instructor} | ${classroom}`);
  });
  doc.end();
});

/**
 * ✅ Export time-in data as DOCX (same format as imported schedule)
 */
export const exportTimeInDocx = asyncHandler(async (req, res) => {
  const { transactions } = req.body;
  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ message: "No transaction data provided" });
  }

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const rooms = ["ComLab 1", "ComLab 2", "ComLab 3", "ComLab 4", "ComLab 5", "ComLab 6", "ComLab 7", "ComLab 8"];
  const formatRangeLabel = (totalMinutes) => {
    const hour24 = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, "0")}`;
  };
  const buildTimeRanges = (startHour = 7, startMinute = 30, endHour = 20, endMinute = 30) => {
    const ranges = [];
    let cursor = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    while (cursor < end) {
      const next = cursor + 30;
      ranges.push({
        label: `${formatRangeLabel(cursor)}-${formatRangeLabel(next)}`,
        startMinutes: cursor,
        endMinutes: next,
      });
      cursor = next;
    }
    return ranges;
  };
  const timeBlocks = buildTimeRanges();

  const normalizeRoom = (roomName) => roomName?.trim().toLowerCase();

  const findRecord = (day, room, block) => {
    return transactions.find((t) => {
      try {
        const recordDay = new Date(t.date || t.timeIn).toLocaleDateString("en-US", { weekday: "long" });
        if (recordDay !== day) return false;
        if (normalizeRoom(t.classroom?.name) !== normalizeRoom(room)) return false;
        const recordTime = new Date(t.timeIn);
        const recordMinutes = recordTime.getHours() * 60 + recordTime.getMinutes();
        return recordMinutes >= block.startMinutes && recordMinutes < block.endMinutes;
      } catch {
        return false;
      }
    });
  };

  const sections = days.map((day) => {
    const rows = [];
    rows.push(new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          children: [new Paragraph({ text: "CLASS SCHEDULE", alignment: AlignmentType.CENTER })],
          width: { size: 1400, type: WidthType.DXA },
        }),
        ...rooms.map(room => new TableCell({
          children: [new Paragraph({ text: room, alignment: AlignmentType.CENTER })],
          width: { size: 2200, type: WidthType.DXA },
          columnSpan: 2,
        })),
      ],
    }));

    rows.push(
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ text: "", alignment: AlignmentType.CENTER })],
            width: { size: 1400, type: WidthType.DXA },
          }),
          ...rooms.flatMap(() => [
            new TableCell({
              children: [new Paragraph({ text: "Course Code/ Instructor", alignment: AlignmentType.CENTER })],
              width: { size: 1100, type: WidthType.DXA },
            }),
            new TableCell({
              children: [
                new Paragraph({ text: "Remarks &", alignment: AlignmentType.CENTER }),
                new Paragraph({ text: "Signature of Monitoring Incharge", alignment: AlignmentType.CENTER }),
              ],
              width: { size: 1100, type: WidthType.DXA },
            }),
          ]),
        ],
      })
    );

    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: day })],
            width: { size: 1400, type: WidthType.DXA },
          }),
          ...rooms.flatMap(() => [
            new TableCell({
              children: [new Paragraph({ text: "" })],
              width: { size: 1100, type: WidthType.DXA },
            }),
            new TableCell({
              children: [new Paragraph({ text: "" })],
              width: { size: 1100, type: WidthType.DXA },
            }),
          ]),
        ],
      })
    );

    timeBlocks.forEach((block) => {
      rows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: block.label, alignment: AlignmentType.CENTER })],
            width: { size: 1400, type: WidthType.DXA },
          }),
          ...rooms.flatMap((room) => {
            const record = findRecord(day, room, block);
            return [
              new TableCell({
                children: record
                  ? [
                      new Paragraph({ text: record.section || "" }),
                      new Paragraph({ text: record.subjectCode || "" }),
                      new Paragraph({ text: record.instructorName || "" }),
                    ]
                  : [new Paragraph({ text: "" })],
                width: { size: 1100, type: WidthType.DXA },
              }),
              new TableCell({
                children: [new Paragraph({ text: record?.remarks?.trim() || "" })],
                width: { size: 1100, type: WidthType.DXA },
              }),
            ];
          }),
        ],
      }));
    });
    return {
      properties: { page: { size: { width: 16840, height: 11900 } } },
      children: [
        new Paragraph({ text: "BUKIDNON STATE UNIVERSITY", alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "OFFICE OF THE VICE PRESIDENT FOR ACADEMIC AFFAIRS", alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "DAILY ROOM UTILIZATION AND CLASS ATTENDANCE MONITORING LOG", alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "2nd Semester AY: 2025 - 2026", alignment: AlignmentType.CENTER }),
        new Paragraph({
          text: "College/Department: COLLEGE OF TECHNOLOGIES - INFORMATION TECHNOLOGY",
          alignment: AlignmentType.LEFT,
        }),
        new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    };
  });

  const doc = new Document({ sections });
  const buffer = await Packer.toBuffer(doc);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename=schedule-report-${new Date().toISOString().split("T")[0]}.docx`);
  res.send(buffer);
});