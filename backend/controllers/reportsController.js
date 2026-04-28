/**
 * Reports Controller
 * Handles listing, generating, sharing, commenting, PDF export, and DOCX export for reports.
 */

import PDFDocument from "pdfkit";
import crypto from 'crypto';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
} from "docx";
import Report from "../models/Report.js";
import ClassroomUsage from "../models/ClassroomUsage.js";
import Schedule from "../models/Schedule.js";
import Classroom from "../models/Classroom.js";
import User from "../models/User.js";
import TimeIn from "../models/TimeIn.js";
import { getStoredReportHeader } from "./systemSettingsController.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const normalizeDayName = (day) => String(day || "").trim().toLowerCase();

const timeToMinutes = (timeStr) => {
  const raw = String(timeStr || "").trim().toUpperCase();
  if (!raw) return NaN;

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return NaN;

  let hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  const meridiem = match[3];

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return NaN;

  if (!meridiem) {
    if (hours >= 1 && hours <= 6) {
      hours += 12;
    }
  } else {
    if (meridiem === "AM" && hours === 12) hours = 0;
    if (meridiem === "PM" && hours !== 12) hours += 12;
  }

  return hours * 60 + minutes;
};

const parseScheduleRange = (scheduleTime) => {
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
};

const getScheduleForRecord = (record) => {
  const schedules = record.classroom?.schedules || [];
  const recordDate = new Date(record.date || record.timeIn);
  const currentDay = normalizeDayName(
    recordDate.toLocaleDateString("en-US", { weekday: "long" }),
  );
  const currentMinutes = recordDate.getHours() * 60 + recordDate.getMinutes();

  return (
    schedules.find((schedule) => {
      if (normalizeDayName(schedule.day) !== currentDay) return false;
      const range = parseScheduleRange(schedule.time);
      if (!range) return false;

      const startMinutes = timeToMinutes(range.start);
      const endMinutes = timeToMinutes(range.end);
      if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) return false;

      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }) || null
  );
};

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
    TimeIn.find(query).populate("student", "firstName lastName email employeeId department").populate("classroom", "name location capacity schedules").populate("verifiedBy", "firstName lastName").sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    TimeIn.countDocuments(query)
  ]);

  const recordsWithScheduleData = timeInTransactions.map((record) => {
    const matchedSchedule = getScheduleForRecord(record);
    const scheduleRange = matchedSchedule
      ? parseScheduleRange(matchedSchedule.time)
      : null;

    return {
      ...record,
      section: matchedSchedule?.section || record.section || "",
      subjectCode: matchedSchedule?.subjectCode || record.subjectCode || "",
      instructorName:
        matchedSchedule?.instructor || record.instructorName || "",
      scheduledStartTime:
        record.scheduledStartTime || scheduleRange?.start || "",
      scheduledEndTime: scheduleRange?.end || "",
    };
  });

  res.json({ data: recordsWithScheduleData, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
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
  const reportHeader = await getStoredReportHeader();

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const rooms = ["ComLab 1", "ComLab 2", "ComLab 3", "ComLab 4", "ComLab 5", "ComLab 6", "ComLab 7", "ComLab 8"];
  const tableBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: "000000",
  };
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
  const normalizeRoom = (roomName) => roomName?.trim().toLowerCase() || "";
  const timeToMinutes = (timeStr) => {
    const raw = String(timeStr || "").trim().toUpperCase();
    if (!raw) return Number.NaN;

    const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
    if (!match) return Number.NaN;

    let hours = Number(match[1]);
    const minutes = Number(match[2] || "0");
    const meridiem = match[3];

    if (Number.isNaN(hours) || Number.isNaN(minutes)) return Number.NaN;

    if (!meridiem) {
      if (hours >= 1 && hours <= 6) {
        hours += 12;
      }
    } else {
      if (meridiem === "AM" && hours === 12) hours = 0;
      if (meridiem === "PM" && hours !== 12) hours += 12;
    }

    return hours * 60 + minutes;
  };
  const parseRecordBounds = (record) => {
    const timeInDate = new Date(record.timeIn || record.date);
    const actualStartMinutes = timeInDate.getHours() * 60 + timeInDate.getMinutes();
    const scheduledStartMinutes = timeToMinutes(record.scheduledStartTime);
    const scheduledEndMinutes = timeToMinutes(record.scheduledEndTime);
    const startMinutes = Number.isNaN(scheduledStartMinutes)
      ? actualStartMinutes
      : scheduledStartMinutes;
    let endMinutes = Number.NaN;

    if (!Number.isNaN(scheduledEndMinutes)) {
      endMinutes = scheduledEndMinutes;
    } else if (record.timeOut) {
      const timeOutDate = new Date(record.timeOut);
      endMinutes = timeOutDate.getHours() * 60 + timeOutDate.getMinutes();
    } else if (!Number.isNaN(scheduledStartMinutes)) {
      endMinutes = scheduledStartMinutes + 30;
    }

    if (endMinutes <= startMinutes) {
      endMinutes = startMinutes + 30;
    }

    return { startMinutes, endMinutes };
  };
  const findBlockIndex = (minutes) =>
    timeBlocks.findIndex(
      (block) => minutes >= block.startMinutes && minutes < block.endMinutes,
    );
  const buildDayGrid = (day) => {
    const grid = rooms.reduce((acc, room) => ({
      ...acc,
      [room]: timeBlocks.map(() => ({ record: null, rowSpan: 1, skip: false })),
    }), {});

    transactions.forEach((record) => {
      try {
        const recordDay = new Date(record.date || record.timeIn).toLocaleDateString("en-US", {
          weekday: "long",
        });
        if (recordDay !== day) return;

        const roomKey = rooms.find((room) => normalizeRoom(room) === normalizeRoom(record.classroom?.name));
        if (!roomKey) return;

        const { startMinutes, endMinutes } = parseRecordBounds(record);
        const startIndex = findBlockIndex(startMinutes);
        if (startIndex === -1) return;

        const endIndex = timeBlocks.findIndex((block) => block.startMinutes >= endMinutes);
        const rowSpan = Math.max(
          1,
          endIndex === -1 ? timeBlocks.length - startIndex : endIndex - startIndex,
        );
        const roomBlocks = grid[roomKey];
        if (!roomBlocks || roomBlocks[startIndex]?.skip) return;

        roomBlocks[startIndex] = { record, rowSpan, skip: false };
        for (let index = startIndex + 1; index < startIndex + rowSpan; index += 1) {
          if (roomBlocks[index]) {
            roomBlocks[index] = { record: null, rowSpan: 0, skip: true };
          }
        }
      } catch {
        // Ignore malformed dates
      }
    });

    return grid;
  };
  const formatInclusiveDates = (records) => {
    const validDates = records
      .map((record) => new Date(record.date || record.timeIn))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (!validDates.length) return "";

    const start = validDates[0];
    const end = validDates[validDates.length - 1];
    const sameMonth =
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear();
    const month = start.toLocaleString("en-US", { month: "long" }).toUpperCase();

    if (sameMonth) {
      return `${month} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
    }

    const startLabel = start.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    }).toUpperCase();
    const endLabel = end.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).toUpperCase();

    return `${startLabel} - ${endLabel}`;
  };
  const makeCellParagraph = (text, options = {}) =>
    new Paragraph({
      alignment: options.alignment || AlignmentType.CENTER,
      spacing: {
        before: options.before ?? 0,
        after: options.after ?? 0,
        line: options.line ?? 240,
      },
      children: [
        new TextRun({
          text: text || "",
          bold: options.bold || false,
          size: options.size || 18,
        }),
      ],
    });
  const makeTableCell = ({
    text = "",
    children,
    width,
    columnSpan,
    rowSpan,
    verticalMerge,
    bold = false,
    size = 18,
    alignment = AlignmentType.CENTER,
  }) =>
    new TableCell({
      width,
      columnSpan,
      rowSpan,
      verticalMerge,
      verticalAlign: VerticalAlign.CENTER,
      borders: {
        top: tableBorder,
        bottom: tableBorder,
        left: tableBorder,
        right: tableBorder,
      },
      margins: {
        top: 70,
        bottom: 70,
        left: 80,
        right: 80,
      },
      children: children || [makeCellParagraph(text, { bold, size, alignment })],
    });

  const weeklyGrid = days.reduce((acc, day) => {
    acc[day] = buildDayGrid(day);
    return acc;
  }, {});
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeTableCell({
          text: "CLASS SCHEDULE",
          width: { size: 1200, type: WidthType.DXA },
          bold: true,
          size: 18,
        }),
        ...rooms.map((room) =>
          makeTableCell({
            text: room,
            width: { size: 1900, type: WidthType.DXA },
            columnSpan: 2,
            bold: true,
            size: 18,
          }),
        ),
      ],
    }),
    new TableRow({
      tableHeader: true,
      children: [
        makeTableCell({
          text: "",
          width: { size: 1200, type: WidthType.DXA },
        }),
        ...rooms.flatMap((room, index) => [
          makeTableCell({
            text: index === 2 ? "Course Code/ Instructor*" : "Course Code/ Instructor",
            width: { size: 950, type: WidthType.DXA },
            bold: true,
            size: 16,
          }),
          makeTableCell({
            children: [
              makeCellParagraph("Remarks &", {
                bold: true,
                size: 16,
              }),
              makeCellParagraph("Signature of Monitoring Incharge", {
                bold: true,
                size: 16,
              }),
            ],
            width: { size: 950, type: WidthType.DXA },
          }),
        ]),
      ],
    }),
  ];

  days.forEach((day) => {
    rows.push(
      new TableRow({
        children: [
          makeTableCell({
            text: day,
            width: { size: 1200, type: WidthType.DXA },
            bold: true,
            alignment: AlignmentType.LEFT,
          }),
          ...rooms.flatMap(() => [
            makeTableCell({
              text: "",
              width: { size: 950, type: WidthType.DXA },
            }),
            makeTableCell({
              text: "",
              width: { size: 950, type: WidthType.DXA },
            }),
          ]),
        ],
      }),
    );

    timeBlocks.forEach((block, blockIndex) => {
      rows.push(
        new TableRow({
          children: [
            makeTableCell({
              text: block.label,
              width: { size: 1200, type: WidthType.DXA },
              size: 16,
            }),
            ...rooms.flatMap((room) => {
              const cell = weeklyGrid[day][room][blockIndex];

              if (cell?.record) {
                return [
                  makeTableCell({
                    width: { size: 950, type: WidthType.DXA },
                    verticalMerge: VerticalMergeType.RESTART,
                    children: [
                      makeCellParagraph(cell.record.section || "", { bold: true, size: 16 }),
                      makeCellParagraph(cell.record.subjectCode || "", { size: 16 }),
                      makeCellParagraph(cell.record.instructorName || "", { size: 16 }),
                    ],
                  }),
                  makeTableCell({
                    text: cell.record.remarks?.trim() || "",
                    width: { size: 950, type: WidthType.DXA },
                    verticalMerge: VerticalMergeType.RESTART,
                    size: 16,
                  }),
                ];
              }

              if (cell?.skip) {
                return [
                  makeTableCell({
                    text: "",
                    width: { size: 950, type: WidthType.DXA },
                    verticalMerge: VerticalMergeType.CONTINUE,
                  }),
                  makeTableCell({
                    text: "",
                    width: { size: 950, type: WidthType.DXA },
                    verticalMerge: VerticalMergeType.CONTINUE,
                  }),
                ];
              }

              return [
                makeTableCell({
                  text: "",
                  width: { size: 950, type: WidthType.DXA },
                }),
                makeTableCell({
                  text: "",
                  width: { size: 950, type: WidthType.DXA },
                }),
              ];
            }),
          ],
        }),
      );
    });
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 720,
            right: 540,
            bottom: 720,
            left: 540,
          },
          size: {
            orientation: PageOrientation.LANDSCAPE,
          },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "OFFICE OF THE VICE PRESIDENT FOR ACADEMIC AFFAIRS", bold: true, size: 18 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
          children: [new TextRun({ text: "DAILY ROOM UTILIZATION AND CLASS ATTENDANCE MONITORING LOG", bold: true, size: 18 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [new TextRun({ text: reportHeader.label, size: 18 })],
        }),
        new Paragraph({
          spacing: { after: 160 },
          children: [
            new TextRun({ text: "College/Department: ", bold: true, size: 18 }),
            new TextRun({ text: "COLLEGE OF TECHNOLOGIES- INFORMATION TECHNOLOGY", size: 18 }),
            new TextRun({ text: "   Inclusive Dates: ", bold: true, size: 18 }),
            new TextRun({ text: formatInclusiveDates(transactions), size: 18 }),
          ],
        }),
        new Table({
          rows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      ],
    }],
  });
  const buffer = await Packer.toBuffer(doc);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename=schedule-report-${new Date().toISOString().split("T")[0]}.docx`);
  res.send(buffer);
});
