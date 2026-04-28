import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./Monitoring.css";
import {
  Clock,
  MapPin,
  User,
  BookOpen,
  AlertTriangle,
  Calendar,
  Plane,
  CheckCircle,
  XCircle,
  RefreshCw,
  Monitor,
  Users,
  Hourglass,
  Info,
} from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher";
  employeeId: string;
  department: string;
}

interface ActiveTimeIn {
  _id: string;
  classroom: string;
  location: string;
  instructorName: string;
  section: string;
  subjectCode: string;
  studentName: string;
  timeIn: string;
  scheduledStartTime: string;
  isLate: boolean;
  classType: string;
  remarks: string;
  isHoliday: boolean;
  holidayInfo?: {
    name: string;
    type: string;
    description: string;
  };
  instructorStatus?: {
    onTravel: boolean;
    onLeave: boolean;
    unavailable: boolean;
    travelDetails: string | null;
    travelStatus: string;
  };
}

interface MonitoringProps {
  user: User;
}

const Monitoring: React.FC<MonitoringProps> = ({ user }) => {
  const [activeTimeIns, setActiveTimeIns] = useState<ActiveTimeIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [holiday, setHoliday] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    synchronous: 0,
    asynchronous: 0,
    late: 0,
    traveling: 0,
  });

  // Fetch active time-ins
  const fetchActiveTimeIns = useCallback(async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem("token");

      const response = await axios.get("/api/timein/monitoring/active", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data;
      setActiveTimeIns(data);

      // Calculate stats
      const newStats = {
        total: data.length,
        synchronous: data.filter(
          (t: ActiveTimeIn) => t.classType === "synchronous",
        ).length,
        asynchronous: data.filter(
          (t: ActiveTimeIn) => t.classType === "asynchronous",
        ).length,
        late: data.filter((t: ActiveTimeIn) => t.isLate).length,
        traveling: data.filter(
          (t: ActiveTimeIn) => t.instructorStatus?.onTravel,
        ).length,
      };
      setStats(newStats);
      setError("");
    } catch (err: any) {
      console.error("Failed to fetch active time-ins:", err);
      setError(err.response?.data?.message || "Failed to load monitoring data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Check holiday
  const checkHoliday = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/timein/check-holiday", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.isHoliday) {
        setHoliday(response.data.holiday);
      }
    } catch (err) {
      console.error("Failed to check holiday:", err);
    }
  };

  useEffect(() => {
    fetchActiveTimeIns();
    checkHoliday();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchActiveTimeIns, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveTimeIns]);

  // Get duration since time-in
  const getDuration = (timeIn: string) => {
    const start = new Date(timeIn);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format time
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading monitoring data...</p>
      </div>
    );
  }

  return (
    <div className="monitoring">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>Classroom Monitoring</h1>
          <p>Real-time classroom utilization and attendance monitoring</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-outline"
            onClick={fetchActiveTimeIns}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="alert alert-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Holiday Banner */}
      {holiday && (
        <div className="holiday-banner">
          <Calendar size={24} color="#ffc107" />
          <div className="holiday-info">
            <h3>📅 Today is {holiday.name}</h3>
            <p>{holiday.type?.toUpperCase()} Holiday</p>
            {holiday.description && (
              <p className="holiday-desc">{holiday.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div
            className="stat-icon"
            style={{ background: "rgba(14, 192, 212, 0.15)" }}
          >
            <Monitor size={24} color="#0ec0d4" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Active Classes</span>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon"
            style={{ background: "rgba(39, 174, 96, 0.15)" }}
          >
            <Users size={24} color="#27ae60" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.synchronous}</span>
            <span className="stat-label">In-Person</span>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon"
            style={{ background: "rgba(23, 162, 184, 0.15)" }}
          >
            <BookOpen size={24} color="#17a2b8" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.asynchronous}</span>
            <span className="stat-label">Online</span>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon"
            style={{ background: "rgba(255, 193, 7, 0.15)" }}
          >
            <Hourglass size={24} color="#ffc107" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.late}</span>
            <span className="stat-label">Late Check-ins</span>
          </div>
        </div>

        <div className="stat-card">
          <div
            className="stat-icon"
            style={{ background: "rgba(23, 162, 184, 0.15)" }}
          >
            <Plane size={24} color="#17a2b8" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.traveling}</span>
            <span className="stat-label">On Travel</span>
          </div>
        </div>
      </div>

      {/* Active Time-Ins Grid */}
      <div className="card">
        <div className="card-header">
          <h2>
            <Monitor size={20} color="#0ec0d4" />
            Active Classes ({stats.total})
          </h2>
        </div>

        <div className="card-body">
          {activeTimeIns.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Monitor size={48} color="rgba(255,255,255,0.3)" />
              </div>
              <h3>No Active Classes</h3>
              <p>There are currently no classes in session.</p>
            </div>
          ) : (
            <div className="monitoring-grid">
              {activeTimeIns.map((record) => (
                <div
                  key={record._id}
                  className={`monitoring-card ${record.isLate ? "late" : ""} ${record.isHoliday ? "holiday" : ""}`}
                >
                  {/* Card Header */}
                  <div className="monitoring-card-header">
                    <div className="classroom-badge">
                      <MapPin size={14} />
                      {record.classroom}
                    </div>
                    <div
                      className="class-type-badge"
                      style={{
                        background:
                          record.classType === "synchronous"
                            ? "rgba(39, 174, 96, 0.15)"
                            : "rgba(23, 162, 184, 0.15)",
                        color:
                          record.classType === "synchronous"
                            ? "#27ae60"
                            : "#17a2b8",
                      }}
                    >
                      {record.classType === "synchronous"
                        ? "In-Person"
                        : "Online"}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="monitoring-card-body">
                    {/* Instructor Info */}
                    <div className="info-row">
                      <User size={14} color="#0ec0d4" />
                      <span className="info-label">Instructor:</span>
                      <span className="info-value">
                        {record.instructorName}
                      </span>

                      {/* Travel/Leave Status */}
                      {record.instructorStatus?.onTravel && (
                        <span
                          className="travel-badge"
                          title={
                            record.instructorStatus.travelDetails ||
                            "On official travel"
                          }
                        >
                          <Plane size={12} />
                          Travel
                        </span>
                      )}
                      {record.instructorStatus?.onLeave && (
                        <span className="leave-badge">
                          <Clock size={12} />
                          Leave
                        </span>
                      )}
                    </div>

                    {/* Section & Subject */}
                    {(record.section || record.subjectCode) && (
                      <div className="info-row">
                        <BookOpen size={14} color="#0ec0d4" />
                        <span className="info-value">
                          {record.section && record.subjectCode
                            ? `${record.section} - ${record.subjectCode}`
                            : record.section || record.subjectCode}
                        </span>
                      </div>
                    )}

                    {/* Student */}
                    <div className="info-row">
                      <User size={14} color="#0ec0d4" />
                      <span className="info-label">Student:</span>
                      <span className="info-value">{record.studentName}</span>
                    </div>

                    {/* Time Info */}
                    <div className="info-row">
                      <Clock size={14} color="#0ec0d4" />
                      <span className="info-label">Check-in:</span>
                      <span className="info-value">
                        {formatTime(record.timeIn)}
                      </span>
                      <span className="duration-badge">
                        {getDuration(record.timeIn)}
                      </span>
                    </div>

                    {/* Late Indicator */}
                    {record.isLate && (
                      <div className="late-indicator">
                        <AlertTriangle size={14} color="#ffc107" />
                        <span>
                          Late! Scheduled: {record.scheduledStartTime || "N/A"},
                          Actual: {formatTime(record.timeIn)}
                        </span>
                      </div>
                    )}

                    {/* Holiday Indicator */}
                    {record.isHoliday && record.holidayInfo && (
                      <div className="holiday-indicator">
                        <Calendar size={14} color="#ffc107" />
                        <span>{record.holidayInfo.name} Holiday</span>
                      </div>
                    )}

                    {/* Remarks */}
                    {record.remarks && (
                      <div className="remarks-row">
                        <Info size={14} color="rgba(255,255,255,0.5)" />
                        <span>{record.remarks}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer - Status */}
                  <div className="monitoring-card-footer">
                    <div className="status-indicator">
                      <div className="status-dot active"></div>
                      <span>Active</span>
                    </div>
                    <div className="location-text">
                      <MapPin size={12} />
                      {record.location || "N/A"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Monitoring;
