import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Reports.css";
import { FileText } from "lucide-react";

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

const buildTimeRanges = (startHour = 7, startMinute = 30, endHour = 20, endMinute = 30) => {
  const ranges: { label: string; startMinutes: number; endMinutes: number }[] = [];
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

const TIME_BLOCKS = buildTimeRanges();

const Reports: React.FC<ReportsProps> = () => {
  const [loading, setLoading] = useState(true);
  const [allTimeins, setAllTimeins] = useState<TimeInRecord[]>([]);
  const [selectedDay, setSelectedDay] = useState("Monday");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTimeins();
  }, []);

  const fetchTimeins = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please log in again.");
        setLoading(false);
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
    }
  };

  const normalizeRoom = (roomName?: string) =>
    roomName?.trim().toLowerCase() || "";

  const getCellData = (room: string, timeBlock: (typeof TIME_BLOCKS)[0]) => {
    if (!Array.isArray(allTimeins)) return null;

    const matching = allTimeins.filter((t) => {
      try {
        const recordDay = new Date(t.date || t.timeIn).toLocaleDateString(
          "en-US",
          { weekday: "long" },
        );
        if (recordDay !== selectedDay) return false;
        if (normalizeRoom(t.classroom?.name) !== normalizeRoom(room)) return false;

        const recordTime = new Date(t.timeIn);
        const recordMinutes = recordTime.getHours() * 60 + recordTime.getMinutes();
        return (
          recordMinutes >= timeBlock.startMinutes &&
          recordMinutes < timeBlock.endMinutes
        );
      } catch {
        return false;
      }
    });

    matching.sort(
      (a, b) =>
        new Date(a.timeIn || a.date).getTime() -
        new Date(b.timeIn || b.date).getTime(),
    );

    return matching[0] || null;
  };

  // ✅ DOCX Download
  const handleDownloadDOCX = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "/api/reports/timein/export-docx",
        { transactions: allTimeins },
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
          <p>Room Utilization - {selectedDay} (Based on Time-In Records)</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button className="btn btn-primary" onClick={handleDownloadDOCX}>
            <FileText size={16} /> Export DOCX
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="report-paper-header">
        <p className="paper-school">BUKIDNON STATE UNIVERSITY</p>
        <p className="paper-office">OFFICE OF THE VICE PRESIDENT FOR ACADEMIC AFFAIRS</p>
        <p className="paper-title">DAILY ROOM UTILIZATION AND CLASS ATTENDANCE MONITORING LOG</p>
        <p className="paper-subtitle">2nd Semester AY: 2025 - 2026</p>
      </div>

      {/* Day Selector */}
      <div className="day-selector">
        {DAYS.map((day) => (
          <button
            key={day}
            className={`day-btn ${selectedDay === day ? "active" : ""}`}
            onClick={() => setSelectedDay(day)}
          >
            {day}
          </button>
        ))}
      </div>
      <div className="report-meta-line">
        College/Department: <strong>COLLEGE OF TECHNOLOGIES - INFORMATION TECHNOLOGY</strong>
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
                    <th key={room} className="room-header room-group-header" colSpan={2}>
                      <div className="room-name">{room}</div>
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="corner-header room-sub-header"></th>
                  {ROOMS.map((room) => (
                    <React.Fragment key={`${room}-subheaders`}>
                      <th className="room-header room-sub-header">Course Code/ Instructor</th>
                      <th className="room-header room-sub-header remarks-header">
                        Remarks & Signature of Monitoring Incharge
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="day-row">
                  <td className="day-cell">{selectedDay}</td>
                  {ROOMS.map((room) => (
                    <React.Fragment key={`${room}-day-empty`}>
                      <td className="day-empty-cell"></td>
                      <td className="day-empty-cell"></td>
                    </React.Fragment>
                  ))}
                </tr>
                {TIME_BLOCKS.map((block) => (
                  <tr key={block.label}>
                    <td className="time-cell">
                      <span className="time-label">{block.label}</span>
                    </td>
                    {ROOMS.map((room) => {
                      const data = getCellData(room, block);
                      return (
                        <React.Fragment key={room}>
                          <td className={`data-cell ${data ? "has-data" : "empty"}`}>
                            <div className="cell-content">
                              <span className="cell-section">{data?.section || " "}</span>
                              <span className="cell-subject">{data?.subjectCode || " "}</span>
                              <span className="cell-instructor">{data?.instructorName || " "}</span>
                            </div>
                          </td>
                          <td className={`data-cell remarks-cell ${data ? "has-data" : "empty"}`}>
                            <div className="cell-content">
                              <span className="cell-instructor">{data?.remarks?.trim() || " "}</span>
                            </div>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
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
