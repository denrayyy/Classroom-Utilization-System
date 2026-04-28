import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import "./Reports.css";
import { FileText, RefreshCw } from "lucide-react";

interface TimeInRecord {
  _id: string;
  date: string;
  timeIn: string;
  timeOut?: string;
  student?: { firstName: string; lastName: string; email: string };
  classroom?: { name: string; location: string };
  instructorName?: string;
  section?: string;
  subjectCode?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  isLate?: boolean;
  remarks?: string;
}

interface ReportsProps {
  user?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

interface ReportHeaderSettings {
  semester: string;
  academicYearStart: string;
  academicYearEnd: string;
  label: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const ROOMS = [
  "ComLab 1",
  "ComLab 2",
  "ComLab 3",
  "ComLab 4",
  "ComLab 5",
  "ComLab 6",
  "ComLab 7",
  "ComLab 8",
];

const formatRangeLabel = (totalMinutes: number) => {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")}`;
};

const buildTimeRanges = (
  startHour = 7,
  startMinute = 30,
  endHour = 20,
  endMinute = 30,
) => {
  const ranges: { label: string; startMinutes: number; endMinutes: number }[] =
    [];
  let cursor = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  const seen = new Set<string>();

  while (cursor < end) {
    const next = cursor + 30;
    const label = `${formatRangeLabel(cursor)}-${formatRangeLabel(next)}`;
    if (!seen.has(label)) {
      ranges.push({
        label,
        startMinutes: cursor,
        endMinutes: next,
      });
      seen.add(label);
    }
    cursor = next;
  }

  return ranges;
};

const TIME_BLOCKS = buildTimeRanges();

const timeToMinutes = (timeStr?: string) => {
  const raw = String(timeStr || "")
    .trim()
    .toUpperCase();
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

const formatInclusiveDates = (records: TimeInRecord[]) => {
  if (!records.length) return "";

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

  const startLabel = start
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
  const endLabel = end
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();

  return `${startLabel} - ${endLabel}`;
};

const Reports: React.FC<ReportsProps> = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allTimeins, setAllTimeins] = useState<TimeInRecord[]>([]);
  const [error, setError] = useState("");
  const [reportHeader, setReportHeader] = useState<ReportHeaderSettings>({
    semester: "2nd Semester",
    academicYearStart: "2025",
    academicYearEnd: "2026",
    label: "2nd Semester AY: 2025 - 2026",
  });

  useEffect(() => {
    fetchReportHeader();
    fetchTimeins({ initialLoad: true });
    const refreshInterval = window.setInterval(() => {
      fetchTimeins({ silent: true });
    }, 30000);

    return () => window.clearInterval(refreshInterval);
  }, []);

  const fetchReportHeader = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await axios.get("/api/system-settings/report-header", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data?.label) {
        setReportHeader(response.data);
      }
    } catch (err) {
      console.error("Failed to load report header settings:", err);
    }
  };

  const fetchTimeins = async ({
    initialLoad = false,
    silent = false,
  }: {
    initialLoad?: boolean;
    silent?: boolean;
  } = {}) => {
    try {
      if (initialLoad) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError("");
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in again.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      let records: TimeInRecord[] = [];

      try {
        const response = await axios.get("/api/reports/timein/all", {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 3000 },
        });
        records = response.data?.data || [];
      } catch (err) {
        console.log("Reports endpoint failed, trying timein list...");
        const response = await axios.get("/api/timein", {
          headers: { Authorization: `Bearer ${token}` },
        });
        records = Array.isArray(response.data) ? response.data : [];
      }

      console.log(`✅ Loaded ${records.length} records`);
      setAllTimeins(records);
    } catch (err: any) {
      console.error("❌ Fetch error:", err);
      setError(
        err.response?.status === 401
          ? "Please log in again."
          : "Failed to load data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const normalizeRoom = (roomName?: string) =>
    roomName?.trim().toLowerCase() || "";

  const parseRecordBounds = (record: TimeInRecord) => {
    const timeInDate = new Date(record.timeIn || record.date);
    const actualStartMinutes =
      timeInDate.getHours() * 60 + timeInDate.getMinutes();
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

    if (Number.isNaN(endMinutes)) {
      endMinutes = startMinutes + 30;
    }

    if (endMinutes <= startMinutes) {
      endMinutes = startMinutes + 30;
    }
    return { startMinutes, endMinutes };
  };

  const findBlockIndex = (minutes: number) =>
    TIME_BLOCKS.findIndex(
      (block) => minutes >= block.startMinutes && minutes < block.endMinutes,
    );

  const buildGridCells = (day: string) => {
    const grid: Record<
      string,
      Array<{ record: TimeInRecord | null; rowSpan: number; skip: boolean }>
    > = ROOMS.reduce(
      (acc, room) => ({
        ...acc,
        [room]: TIME_BLOCKS.map(() => ({
          record: null,
          rowSpan: 1,
          skip: false,
        })),
      }),
      {} as Record<
        string,
        Array<{ record: TimeInRecord | null; rowSpan: number; skip: boolean }>
      >,
    );

    if (!Array.isArray(allTimeins)) return grid;

    allTimeins.forEach((record) => {
      try {
        const recordDay = new Date(
          record.date || record.timeIn,
        ).toLocaleDateString("en-US", { weekday: "long" });
        if (recordDay !== day) return;

        const roomName = normalizeRoom(record.classroom?.name);
        const roomKey = ROOMS.find((room) => normalizeRoom(room) === roomName);
        if (!roomKey) return;

        const { startMinutes, endMinutes } = parseRecordBounds(record);
        const startIndex = findBlockIndex(startMinutes);
        if (startIndex === -1) return;

        const endIndex = TIME_BLOCKS.findIndex(
          (block) => block.startMinutes >= endMinutes,
        );
        const span = Math.max(
          1,
          endIndex === -1
            ? TIME_BLOCKS.length - startIndex
            : endIndex - startIndex,
        );

        const roomBlocks = grid[roomKey];
        if (!roomBlocks || roomBlocks[startIndex]?.skip) return;

        roomBlocks[startIndex] = { record, rowSpan: span, skip: false };
        for (
          let index = startIndex + 1;
          index < startIndex + span;
          index += 1
        ) {
          if (roomBlocks[index]) {
            roomBlocks[index] = { record: null, rowSpan: 0, skip: true };
          }
        }
      } catch {
        // ignore malformed record dates
      }
    });

    return grid;
  };

  const weeklyGrid = useMemo(
    () =>
      DAYS.reduce(
        (acc, day) => {
          acc[day] = buildGridCells(day);
          return acc;
        },
        {} as Record<
          string,
          Record<
            string,
            Array<{
              record: TimeInRecord | null;
              rowSpan: number;
              skip: boolean;
            }>
          >
        >,
      ),
    [allTimeins],
  );

  const inclusiveDates = useMemo(
    () => formatInclusiveDates(allTimeins),
    [allTimeins],
  );

  // ✅ DOCX Download
  const handleDownloadDOCX = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "/api/reports/timein/export-docx",
        { transactions: allTimeins, reportHeader },
        { headers: { Authorization: `Bearer ${token}` }, responseType: "blob" },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-report-${new Date().toISOString().split("T")[0]}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOCX download failed:", err);
    }
  };

  return (
    <div className="reports">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>Schedule Reports</h1>
          <p>Room utilization and class attendance monitoring log</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            className="btn btn-outline"
            onClick={() => fetchTimeins()}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "spin-icon" : undefined}
            />{" "}
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn btn-primary" onClick={handleDownloadDOCX}>
            <FileText size={16} /> Export DOCX
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="report-paper-header">
        <p className="paper-office">
          OFFICE OF THE VICE PRESIDENT FOR ACADEMIC AFFAIRS
        </p>
        <p className="paper-title">
          DAILY ROOM UTILIZATION AND CLASS ATTENDANCE MONITORING LOG
        </p>
        <p className="paper-subtitle">{reportHeader.label}</p>
      </div>
      <div className="report-meta-line">
        College/Department:{" "}
        <strong>COLLEGE OF TECHNOLOGIES- INFORMATION TECHNOLOGY</strong>
        <span className="report-meta-separator">Inclusive Dates:</span>
        <strong>{inclusiveDates || " "}</strong>
      </div>

      {/* Grid Table */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading schedule data...</p>
        </div>
      ) : (
        <div className="docx-grid-container">
          <div className="docx-table-wrapper">
            <table className="docx-grid-table">
              <thead>
                <tr>
                  <th className="corner-header">CLASS SCHEDULE</th>
                  {ROOMS.map((room) => (
                    <th
                      key={room}
                      className="room-header room-group-header"
                      colSpan={2}
                    >
                      <div className="room-name">{room}</div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="corner-header room-sub-header"></th>
                  {ROOMS.map((room) => (
                    <React.Fragment key={`${room}-subheaders`}>
                      <th className="room-header room-sub-header">
                        Course Code/ Instructor
                      </th>
                      <th className="room-header room-sub-header remarks-header">
                        Remarks & Signature of Monitoring Incharge
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => (
                  <React.Fragment key={day}>
                    <tr className="day-row">
                      <td className="day-cell">{day}</td>
                      {ROOMS.map((room) => (
                        <React.Fragment key={`${day}-${room}-day-empty`}>
                          <td className="day-empty-cell"></td>
                          <td className="day-empty-cell"></td>
                        </React.Fragment>
                      ))}
                    </tr>
                    {TIME_BLOCKS.map((block, blockIndex) => (
                      <tr key={`${day}-${block.label}`}>
                        <td className="time-cell">
                          <span className="time-label">{block.label}</span>
                        </td>
                        {ROOMS.map((room) => {
                          const cell = weeklyGrid[day][room][blockIndex];
                          if (cell?.skip) {
                            return (
                              <React.Fragment
                                key={`${day}-${room}-${blockIndex}`}
                              />
                            );
                          }

                          if (cell?.record) {
                            return (
                              <React.Fragment key={`${day}-${room}`}>
                                <td
                                  rowSpan={cell.rowSpan}
                                  className="data-cell has-data"
                                >
                                  <div className="cell-content">
                                    <span className="cell-section">
                                      {cell.record.section || " "}
                                    </span>
                                    <span className="cell-subject">
                                      {cell.record.subjectCode || " "}
                                    </span>
                                    <span className="cell-instructor">
                                      {cell.record.instructorName || " "}
                                    </span>
                                  </div>
                                </td>
                                <td
                                  rowSpan={cell.rowSpan}
                                  className="data-cell remarks-cell has-data"
                                >
                                  <div className="cell-content">
                                    <span className="cell-instructor">
                                      {cell.record.remarks?.trim() || " "}
                                    </span>
                                  </div>
                                </td>
                              </React.Fragment>
                            );
                          }

                          return (
                            <React.Fragment
                              key={`${day}-${room}-${blockIndex}`}
                            >
                              <td className="data-cell empty"></td>
                              <td className="data-cell remarks-cell empty"></td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
