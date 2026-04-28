/**
 * Reports Controller
 * Handles listing, generating, sharing, commenting, PDF export, and DOCX export for reports.
 */

import PDFDocument from "pdfkit";
import crypto from 'crypto';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
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
import SystemSettings from "../models/SystemSettings.js";
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

// ============ FONT CONSTANTS ============
const FONT_BOOK_ANTIQUA = "Book Antiqua";
const FONT_TIMES_NEW_ROMAN = "Times New Roman";
const FONT_ARIAL_NARROW = "Arial Narrow";

// ============ HELPER FUNCTIONS ============
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
  if (!meridiem) { if (hours >= 1 && hours <= 6) hours += 12; }
  else { if (meridiem === "AM" && hours === 12) hours = 0; if (meridiem === "PM" && hours !== 12) hours += 12; }
  return hours * 60 + minutes;
};

const parseScheduleRange = (scheduleTime) => {
  const parts = String(scheduleTime || "").split("-").map((v) => v?.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return { start: parts[0], end: parts[parts.length - 1] };
};

const getScheduleForRecord = (record) => {
  const schedules = record.classroom?.schedules || [];
  const recordDate = new Date(record.date || record.timeIn);
  const currentDay = normalizeDayName(recordDate.toLocaleDateString("en-US", { weekday: "long" }));
  const currentMinutes = recordDate.getHours() * 60 + recordDate.getMinutes();
  return schedules.find((schedule) => {
    if (normalizeDayName(schedule.day) !== currentDay) return false;
    const range = parseScheduleRange(schedule.time);
    if (!range) return false;
    const startMinutes = timeToMinutes(range.start);
    const endMinutes = timeToMinutes(range.end);
    if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes)) return false;
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }) || null;
};

// ============ EXPORT FUNCTIONS ============

export const list = asyncHandler(async (req, res) => {
  const { type, status, startDate, endDate, week, month, page = 1, limit = 10 } = req.query;
  const query = {};
  if (req.user.role === "teacher") query.$or = [{ generatedBy: req.user._id }, { "sharedWith.user": req.user._id }];
  if (type) query.type = type;
  if (status) query.status = status;
  if (startDate && endDate) { query["period.startDate"] = { $gte: new Date(startDate) }; query["period.endDate"] = { $lte: new Date(endDate) }; }
  const pageNum = parseInt(page); const limitNum = parseInt(limit);
  const [reports, total] = await Promise.all([
    Report.find(query).populate("generatedBy", "firstName lastName email employeeId").populate("sharedWith.user", "firstName lastName email").sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    Report.countDocuments(query)
  ]);
  res.json({ reports, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
});

export const getTimeInAll = asyncHandler(async (req, res) => {
  const { date, month, studentName, instructorName, classroom, page = 1, limit = 1000, sortBy = "date", sortOrder = "desc" } = req.query;
  const query = {};
  if (date) { const d = new Date(date); const s = new Date(d); s.setHours(0,0,0,0); const e = new Date(d); e.setHours(23,59,59,999); query.date = { $gte: s, $lte: e }; }
  if (month) { const [y, m] = month.split("-"); query.date = { $gte: new Date(Number(y), Number(m)-1, 1), $lte: new Date(Number(y), Number(m), 0, 23, 59, 59, 999) }; }
  if (classroom) query.classroom = classroom;
  const pageNum = parseInt(page); const limitNum = parseInt(limit);
  const [timeInTransactions, total] = await Promise.all([
    TimeIn.find(query).populate("student", "firstName lastName email employeeId department").populate("classroom", "name location capacity schedules").populate("verifiedBy", "firstName lastName").sort({ [sortBy]: sortOrder === "asc" ? 1 : -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    TimeIn.countDocuments(query)
  ]);
  const recordsWithScheduleData = timeInTransactions.map((record) => {
    const matchedSchedule = getScheduleForRecord(record);
    const scheduleRange = matchedSchedule ? parseScheduleRange(matchedSchedule.time) : null;
    return {
      ...record,
      section: matchedSchedule?.section || record.section || "",
      subjectCode: matchedSchedule?.subjectCode || record.subjectCode || "",
      instructorName: matchedSchedule?.instructor || record.instructorName || "",
      scheduledStartTime: record.scheduledStartTime || scheduleRange?.start || "",
      scheduledEndTime: scheduleRange?.end || "",
    };
  });
  res.json({ data: recordsWithScheduleData, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
});

export const getById = asyncHandler(async (req, res) => { const r = await Report.findById(req.params.id).populate("generatedBy", "firstName lastName email employeeId").populate("sharedWith.user", "firstName lastName email").lean(); if (!r) return res.status(404).json({ message: "Report not found" }); res.json(r); });
export const generateTeacher = asyncHandler(async (req, res) => { const { startDate, endDate, title } = req.body; const s = new Date(startDate); const e = new Date(endDate); const records = await ClassroomUsage.find({ teacher: req.user._id, date: { $gte: s, $lte: e } }).populate("classroom", "name location capacity").sort({ date: 1 }).lean(); const r = new Report({ title: title || `Teacher Report`, type: "teacher", generatedBy: req.user._id, period: { startDate: s, endDate: e }, data: { usageRecords: records }, status: "completed" }); await r.save(); res.status(201).json({ message: "Teacher report generated", report: r }); });
export const generateAdmin = asyncHandler(async (req, res) => { const { startDate, endDate, title } = req.body; const s = new Date(startDate); const e = new Date(endDate); const records = await ClassroomUsage.find({ date: { $gte: s, $lte: e } }).populate("classroom", "name location capacity").sort({ date: 1 }).lean(); const r = new Report({ title: title || `Admin Report`, type: "admin", generatedBy: req.user._id, period: { startDate: s, endDate: e }, data: { usageRecords: records }, status: "completed" }); await r.save(); res.status(201).json({ message: "Admin report generated", report: r }); });
export const generateWeekly = asyncHandler(async (req, res) => { const { startDate } = req.body; const s = new Date(startDate); const e = new Date(s); e.setDate(e.getDate() + 6); const records = await ClassroomUsage.find({ date: { $gte: s, $lte: e } }).populate("classroom", "name location capacity").sort({ date: 1 }).lean(); const r = new Report({ title: `Weekly Report`, type: "weekly", generatedBy: req.user._id, period: { startDate: s, endDate: e }, data: { usageRecords: records }, status: "completed" }); await r.save(); res.status(201).json({ message: "Weekly report generated", report: r }); });
export const share = asyncHandler(async (req, res) => { const { userIds } = req.body; const r = await Report.findById(req.params.id); if (!r) return res.status(404).json({ message: "Report not found" }); const newShares = userIds.filter(id => !r.sharedWith.some(s => s.user.toString() === id)).map(userId => ({ user: userId, sharedAt: new Date() })); r.sharedWith.push(...newShares); await r.save(); res.json({ message: "Report shared", report: r }); });
export const remove = asyncHandler(async (req, res) => { const r = await Report.findById(req.params.id); if (!r) return res.status(404).json({ message: "Report not found" }); await Report.findByIdAndDelete(req.params.id); res.json({ message: "Report deleted" }); });
export const archiveDaily = asyncHandler(async (req, res) => { const { archiveDailyRecords } = await import("../utils/dailyArchive.js"); await archiveDailyRecords(); res.json({ message: "Daily archive completed" }); });
export const updateComment = asyncHandler(async (req, res) => { const version = requireVersion(req.body.version); const { comment } = req.body; const r = await runVersionedUpdate(Report, req.params.id, version, buildVersionedUpdateDoc({ comment: comment || "" })); if (!r) return respondWithConflict(res, "Report"); await r.populate([{ path: "generatedBy", select: "firstName lastName email employeeId" }, { path: "sharedWith.user", select: "firstName lastName email" }]); res.json({ message: "Comment updated", report: r }); });
export const exportTimeInPdf = asyncHandler(async (req, res) => { const { transactions } = req.body; if (!transactions?.length) throw new Error("No data"); const doc = new PDFDocument({ size: "A4", margin: 50 }); res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Disposition", `attachment; filename=timein-report.pdf`); doc.pipe(res); doc.fontSize(20).text("Time-In Report", { align: "center" }); doc.moveDown(); doc.fontSize(10); transactions.forEach((r) => { doc.text(`${new Date(r.timeIn).toLocaleDateString()} | ${new Date(r.timeIn).toLocaleTimeString()} | ${r.student?.firstName || ''} ${r.student?.lastName || ''} | ${r.instructorName || '—'} | ${r.classroom?.name || '—'}`); }); doc.end(); });

/**
 * ✅ Export time-in data as DOCX with proper fonts, sizes, logo, and layout
 * FIXED: Clamped rowSpan and guarded against undefined cells to prevent
 * "Word found unreadable content" error caused by invalid vertical merges.
 */
export const exportTimeInDocx = asyncHandler(async (req, res) => {
  const { transactions } = req.body;
  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ message: "No transaction data provided" });
  }

  const classrooms = await Classroom.find({ name: { $regex: /comlab/i }, isArchived: false }).sort({ name: 1 });
  const rooms = classrooms.map((c) => c.name);
  const settings = await SystemSettings.getSettings();
  const docCode = settings.documentCode || "OVPAA-F-INS-068";
  const revision = settings.revisionNo || 0;
  const issueDateStr = settings.issueDate ? new Date(settings.issueDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "October 9, 2024";

  // Logo
  const logoPath = path.join(__dirname, "../assets/logo.png");
  const fallbackLogoPath = path.join(__dirname, "../assets/buksu-logo.png");
  const resolvedLogoPath = fs.existsSync(logoPath) ? logoPath : fallbackLogoPath;
  const logoBuffer = fs.existsSync(resolvedLogoPath) ? fs.readFileSync(resolvedLogoPath) : null;

  const reportHeader = { label: "2nd Semester AY: 2025 - 2026" };
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const tableBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };

  const formatRangeLabel = (totalMinutes) => {
    const h = Math.floor(totalMinutes / 60); const m = totalMinutes % 60;
    const h12 = h % 12 || 12; return `${h12}:${String(m).padStart(2, "0")}`;
  };
  const buildTimeRanges = (startH = 7, startM = 30, endH = 20, endM = 30) => {
    const ranges = []; let cursor = startH * 60 + startM; const end = endH * 60 + endM;
    while (cursor < end) { const next = cursor + 30; ranges.push({ label: `${formatRangeLabel(cursor)}-${formatRangeLabel(next)}`, startMinutes: cursor, endMinutes: next }); cursor = next; }
    return ranges;
  };
  const timeBlocks = buildTimeRanges();
  const normalizeRoom = (roomName) => roomName?.trim().toLowerCase() || "";

  const parseRecordBounds = (record) => {
    const timeInDate = new Date(record.timeIn || record.date);
    const actualStart = timeInDate.getHours() * 60 + timeInDate.getMinutes();
    const schedStart = timeToMinutes(record.scheduledStartTime);
    const schedEnd = timeToMinutes(record.scheduledEndTime);
    const startMinutes = Number.isNaN(schedStart) ? actualStart : schedStart;
    let endMinutes = Number.NaN;
    if (!Number.isNaN(schedEnd)) endMinutes = schedEnd;
    else if (record.timeOut) { const d = new Date(record.timeOut); endMinutes = d.getHours() * 60 + d.getMinutes(); }
    else if (!Number.isNaN(schedStart)) endMinutes = schedStart + 30;
    if (endMinutes <= startMinutes) endMinutes = startMinutes + 30;
    return { startMinutes, endMinutes };
  };

  const findBlockIndex = (minutes) => timeBlocks.findIndex((b) => minutes >= b.startMinutes && minutes < b.endMinutes);

  // ✅ FIXED: buildDayGrid now clamps rowSpan to prevent overflow past timeBlocks length
  const buildDayGrid = (day) => {
    const grid = rooms.reduce((acc, room) => ({ ...acc, [room]: timeBlocks.map(() => ({ record: null, rowSpan: 1, skip: false })) }), {});
    transactions.forEach((record) => {
      try {
        const recordDay = new Date(record.date || record.timeIn).toLocaleDateString("en-US", { weekday: "long" });
        if (recordDay !== day) return;
        const roomKey = rooms.find((room) => normalizeRoom(room) === normalizeRoom(record.classroom?.name));
        if (!roomKey) return;
        const { startMinutes, endMinutes } = parseRecordBounds(record);
        const startIndex = findBlockIndex(startMinutes);
        if (startIndex === -1) return;
        const endIndex = timeBlocks.findIndex((b) => b.startMinutes >= endMinutes);
        const rawRowSpan = endIndex === -1 ? timeBlocks.length - startIndex : endIndex - startIndex;
        const rowSpan = Math.max(
          1,
          Math.min(rawRowSpan, timeBlocks.length - startIndex),
        );
        const roomBlocks = grid[roomKey];
        if (!roomBlocks || roomBlocks[startIndex]?.skip) return;
        roomBlocks[startIndex] = { record, rowSpan, skip: false };
        for (let i = startIndex + 1; i < startIndex + rowSpan; i++) {
          if (roomBlocks[i]) roomBlocks[i] = { record: null, rowSpan: 0, skip: true };
        }
      } catch { /* ignore */ }
    });

    // Prevent CONTINUE merges before the first RESTART cell in each room column.
    rooms.forEach((room) => {
      const roomBlocks = grid[room] || [];
      let hasRestart = false;

      roomBlocks.forEach((cell) => {
        if (!cell) return;

        if (cell.record) {
          hasRestart = true;
          return;
        }

        if (cell.skip && !hasRestart) {
          cell.skip = false;
        }
      });
    });

    return grid;
  };

  const formatInclusiveDates = (records) => {
    const valid = records.map((r) => new Date(r.date || r.timeIn)).filter((d) => !Number.isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
    if (!valid.length) return "";
    const start = valid[0]; const end = valid[valid.length - 1];
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    if (sameMonth) return `${start.toLocaleString("en-US", { month: "long" }).toUpperCase()} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
    return `${start.toLocaleDateString("en-US", { month: "long", day: "numeric" }).toUpperCase()} - ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase()}`;
  };

  const makeCellParagraph = (text, options = {}) => new Paragraph({
    alignment: options.alignment || AlignmentType.CENTER,
    spacing: { before: options.before ?? 0, after: options.after ?? 0, line: options.line ?? 240 },
    children: [new TextRun({ text: text || "", bold: options.bold || false, size: options.size || 16, font: options.font || FONT_BOOK_ANTIQUA })],
  });

  const makeTableCell = ({ text = "", children, width, columnSpan, rowSpan, verticalMerge, bold = false, size = 16, alignment = AlignmentType.CENTER, shading, font = FONT_BOOK_ANTIQUA }) =>
    new TableCell({ width, columnSpan, rowSpan, verticalMerge, verticalAlign: VerticalAlign.CENTER, borders: { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder }, margins: { top: 50, bottom: 50, left: 60, right: 60 }, shading, children: children || [makeCellParagraph(text, { bold, size, alignment, font })] });

  const weeklyGrid = days.reduce((acc, day) => { acc[day] = buildDayGrid(day); return acc; }, {});

  const rows = [
    // Row 1: CLASS SCHEDULE + Room names
    new TableRow({ tableHeader: false, children: [
      makeTableCell({ text: "CLASS SCHEDULE", width: { size: 1200, type: WidthType.DXA }, bold: true, size: 18, font: FONT_BOOK_ANTIQUA }),
      ...rooms.map((room) => makeTableCell({ text: room, width: { size: 1900, type: WidthType.DXA }, columnSpan: 2, bold: true, size: 18, font: FONT_BOOK_ANTIQUA })),
    ]}),
    // Row 2: Course Code/Instructor + Remarks headers
    new TableRow({ tableHeader: true, children: [
      makeTableCell({ text: "", width: { size: 1200, type: WidthType.DXA } }),
      ...rooms.flatMap((_, index) => [
        makeTableCell({ text: index === 2 ? "Course Code/ Instructor*" : "Course Code/ Instructor", width: { size: 950, type: WidthType.DXA }, bold: true, size: 14, font: FONT_BOOK_ANTIQUA }),
        makeTableCell({ children: [makeCellParagraph("Remarks &", { bold: true, size: 14, font: FONT_BOOK_ANTIQUA }), makeCellParagraph("Signature of Monitoring Incharge", { bold: true, size: 14, font: FONT_BOOK_ANTIQUA })], width: { size: 950, type: WidthType.DXA } }),
      ]),
    ]}),
  ];

  // ✅ FIXED: Guarded cell access with optional chaining and null checks
  days.forEach((day) => {
    // Day row with #D9E2F3 background
    rows.push(new TableRow({ children: [
      makeTableCell({ text: day, width: { size: 1200, type: WidthType.DXA }, bold: true, alignment: AlignmentType.LEFT, size: 20, font: FONT_ARIAL_NARROW, shading: { type: ShadingType.CLEAR, fill: "D9E2F3" } }),
      ...rooms.flatMap(() => [
        makeTableCell({ text: "", width: { size: 950, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "D9E2F3" } }),
        makeTableCell({ text: "", width: { size: 950, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "D9E2F3" } }),
      ]),
    ]}));

    // Time block rows
    timeBlocks.forEach((block, blockIndex) => {
      rows.push(new TableRow({ children: [
        makeTableCell({ text: block.label, width: { size: 1200, type: WidthType.DXA }, size: 18, font: FONT_TIMES_NEW_ROMAN }),
        ...rooms.flatMap((room) => {
          const roomBlocks = weeklyGrid?.[day]?.[room];
          const cell = roomBlocks?.[blockIndex] ?? null;

          if (!roomBlocks || !cell) {
            return [
              makeTableCell({ text: "", width: { size: 950, type: WidthType.DXA } }),
              makeTableCell({ text: "", width: { size: 950, type: WidthType.DXA } }),
            ];
          }

          if (cell.skip) {
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

          // Cell has a record — start of merged block
          if (cell.record) {
            return [
              makeTableCell({
                width: { size: 950, type: WidthType.DXA },
                verticalMerge: VerticalMergeType.RESTART,
                children: [
                  makeCellParagraph(cell.record.section || "", { bold: true, size: 16, font: FONT_BOOK_ANTIQUA }),
                  makeCellParagraph(cell.record.subjectCode || "", { size: 16, font: FONT_BOOK_ANTIQUA }),
                  makeCellParagraph(cell.record.instructorName || "", { size: 16, font: FONT_BOOK_ANTIQUA }),
                ],
              }),
              makeTableCell({
                text: cell.record.remarks?.trim() || "",
                width: { size: 950, type: WidthType.DXA },
                verticalMerge: VerticalMergeType.RESTART,
                size: 16,
                font: FONT_BOOK_ANTIQUA,
              }),
            ];
          }

          // Empty cell (no record, no skip)
          return [
            makeTableCell({ text: "", width: { size: 950, type: WidthType.DXA } }),
            makeTableCell({ text: "", width: { size: 950, type: WidthType.DXA } }),
          ];
        }),
      ]}));
    });
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 500, right: 400, bottom: 500, left: 400 }, size: { orientation: PageOrientation.LANDSCAPE } } },
      headers: {
  default: new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0 },
          bottom: { style: BorderStyle.NONE, size: 0 },
          left: { style: BorderStyle.NONE, size: 0 },
          right: { style: BorderStyle.NONE, size: 0 },
          insideHorizontal: { style: BorderStyle.NONE, size: 0 },
          insideVertical: { style: BorderStyle.NONE, size: 0 },
        },
        rows: [
  new TableRow({
    children: [
      // Left: Logo cell
      new TableCell({
        width: { size: 700, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 50, right: 50 },
        verticalAlign: VerticalAlign.CENTER,
        children: (() => {
  try {
    if (logoBuffer && logoBuffer.length > 100) {
      return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: logoBuffer, transformation: { width: 55, height: 55 } })] })];
    }
    return [new Paragraph({ children: [] })];
  } catch (e) {
    console.warn("Logo embed failed:", e.message);
    return [new Paragraph({ children: [] })];
  }
})(),
      }),
      // Center: University text
      new TableCell({
        width: { size: 7500, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: "BUKIDNON STATE UNIVERSITY", bold: true, size: 24, font: FONT_BOOK_ANTIQUA })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: "Malaybalay City, Bukidnon 8700", size: 20, font: FONT_BOOK_ANTIQUA })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: "Tel (088) 813-5661 to 5663; Telefax (088) 813-2717, www.buksu.edu.ph", size: 18, font: FONT_BOOK_ANTIQUA })] }),
        ],
      }),
      // Right: Empty spacer cell for symmetry
      new TableCell({
        width: { size: 700, type: WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({ children: [] })],
      }),
    ],
  }),
],
      }),
    ],
  }),
},
      footers: {
  default: new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          // Document info on left
          new TextRun({ text: `Document Code: ${docCode}`, size: 16, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: "\t\t\t", size: 16, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: `Revision no. ${revision}`, size: 16, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: "\t\t\t", size: 16, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: `Issue Date: ${issueDateStr}`, size: 16, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: "\t\t\t", size: 16, font: FONT_BOOK_ANTIQUA }),
          // Page number on right
          new TextRun({ text: "Page ", size: 16, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: " of ", size: 16, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: FONT_BOOK_ANTIQUA }),
        ],
      }),
    ],
  }),
},
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "OFFICE OF THE VICE PRESIDENT FOR ACADEMIC AFFAIRS", bold: true, size: 20, font: FONT_BOOK_ANTIQUA })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: "DAILY ROOM UTILIZATION AND CLASS ATTENDANCE MONITORING LOG", bold: true, size: 20, font: FONT_BOOK_ANTIQUA })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: reportHeader.label, size: 20, font: FONT_BOOK_ANTIQUA })] }),
        new Paragraph({ spacing: { after: 120 }, children: [
          new TextRun({ text: "College/Department: ", bold: true, size: 20, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: "COLLEGE OF TECHNOLOGIES- INFORMATION TECHNOLOGY", size: 20, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: "   Inclusive Dates: ", bold: true, size: 20, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: formatInclusiveDates(transactions), size: 20, font: FONT_BOOK_ANTIQUA }),
        ]}),
        new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        new Paragraph({ spacing: { before: 300 }, children: [] }),
        new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 40 }, children: [
          new TextRun({ text: "Prepared by/Date:", bold: true, size: 24, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: "\t\t\t\t\t\t\t", size: 24 }),
          new TextRun({ text: "Verified by/Date:", bold: true, size: 24, font: FONT_BOOK_ANTIQUA }),
        ]}),
        new Paragraph({ spacing: { after: 40 }, children: [] }),
        new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 40 }, children: [
          new TextRun({ text: "_____________________________", size: 24 }),
          new TextRun({ text: "\t\t\t\t", size: 24 }),
          new TextRun({ text: "_____________________________", size: 24 }),
        ]}),
        new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 80 }, children: [
          new TextRun({ text: "Attendance Monitoring In-charge", bold: true, size: 24, font: FONT_BOOK_ANTIQUA }),
          new TextRun({ text: "\t\t\t\t", size: 24 }),
          new TextRun({ text: "Department Head", bold: true, size: 24, font: FONT_BOOK_ANTIQUA }),
        ]}),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename=schedule-report-${new Date().toISOString().split("T")[0]}.docx`);
  res.send(buffer);
});