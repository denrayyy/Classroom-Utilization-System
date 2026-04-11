import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Reports.css";
import {
  Search,
  X,
  Calendar,
  User,
  DoorOpen,
  Download,
  Eye,
  Filter,
  Users,
  Clock,
  TrendingUp,
  FileText,
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

interface Report {
  _id: string;
  title: string;
  type:
    | "daily"
    | "weekly"
    | "monthly"
    | "teacher"
    | "admin"
    | "utilization"
    | "semester";
  generatedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  period: {
    startDate: string;
    endDate: string;
  };
  data: {
    statistics?: {
      totalRecords: number;
      verifiedRecords: number;
      pendingRecords: number;
      verificationRate?: number;
    };
    records?: any[];
    classroomStats?: any[];
  };
  summary: {
    totalClassrooms: number;
    totalUtilization: number;
    averageUtilization?: number;
    underutilizedClassrooms?: number;
  };
  status: string;
  comment?: string;
  createdAt: string;
}

interface TimeInRecord {
  _id: string;
  date: string;
  timeIn: string;
  timeOut?: string;
  student?: {
    firstName: string;
    lastName: string;
    email: string;
    department?: string;
  };
  classroom?: {
    name: string;
    location: string;
  };
  instructorName?: string;
  evidence?: {
    filename: string;
    originalName?: string;
  };
}

interface ReportsProps {
  user: User;
}

const Reports: React.FC<ReportsProps> = ({ user }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedInstructor, setSelectedInstructor] = useState<string>("");
  const [selectedClassroom, setSelectedClassroom] = useState<string>("");
  const [allTimeins, setAllTimeins] = useState<TimeInRecord[]>([]);
  const [filteredTimeins, setFilteredTimeins] = useState<TimeInRecord[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [comment, setComment] = useState("");
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [evidenceModal, setEvidenceModal] = useState<{
    open: boolean;
    url: string;
    filename: string;
    isBlob?: boolean;
  }>({
    open: false,
    url: "",
    filename: "",
    isBlob: false,
  });
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Unique options for filters
  const [instructorOptions, setInstructorOptions] = useState<string[]>([]);
  const [classroomOptions, setClassroomOptions] = useState<string[]>([]);

  // Summary stats
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalClassrooms, setTotalClassrooms] = useState(0);
  const [avgTimeIn, setAvgTimeIn] = useState<string>("");

  // Determine what the search is targeting
  const [searchTarget, setSearchTarget] = useState<
    "student" | "instructor" | "both" | "none"
  >("none");

  useEffect(() => {
    fetchTimeins();
  }, [selectedMonth]);

  useEffect(() => {
    filterTimeins();
  }, [
    allTimeins,
    searchQuery,
    selectedInstructor,
    selectedClassroom,
    selectedMonth,
  ]);

  useEffect(() => {
    extractFilterOptions();
    calculateStats();
    detectSearchTarget();
  }, [allTimeins, searchQuery]);

  const detectSearchTarget = () => {
    if (!searchQuery.trim()) {
      setSearchTarget("none");
      return;
    }

    const query = searchQuery.toLowerCase();

    const matchesInstructor = instructorOptions.some((instructor) =>
      instructor.toLowerCase().includes(query),
    );

    const matchesStudent = allTimeins.some((t) => {
      const studentName =
        `${t.student?.firstName || ""} ${t.student?.lastName || ""}`.toLowerCase();
      return studentName.includes(query);
    });

    if (matchesInstructor && !matchesStudent) {
      setSearchTarget("instructor");
    } else if (matchesStudent && !matchesInstructor) {
      setSearchTarget("student");
    } else if (matchesInstructor && matchesStudent) {
      setSearchTarget("both");
    } else {
      setSearchTarget("none");
    }
  };

  const fetchTimeins = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No auth token");

      const params: any = {
        limit: 1000,
      };

      if (selectedMonth) {
        params.month = selectedMonth;
      }

      const response = await axios.get("/api/reports/timein/all", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (response.data.data) {
        setAllTimeins(response.data.data);
      } else {
        setAllTimeins(response.data || []);
      }
    } catch (err: any) {
      console.error("Error fetching time-ins:", err);
      setError(err.response?.data?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const filterTimeins = () => {
    let filtered = [...allTimeins];

    if (selectedMonth) {
      const [year, monthNum] = selectedMonth.split("-");
      filtered = filtered.filter((t) => {
        const d = new Date(t.date);
        return (
          d.getFullYear() === Number(year) &&
          d.getMonth() + 1 === Number(monthNum)
        );
      });
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t) => {
        const studentName =
          `${t.student?.firstName || ""} ${t.student?.lastName || ""}`.toLowerCase();
        const instructorName = (t.instructorName || "").toLowerCase();
        return studentName.includes(query) || instructorName.includes(query);
      });
    }

    if (selectedInstructor) {
      filtered = filtered.filter(
        (t) => t.instructorName === selectedInstructor,
      );
    }

    if (selectedClassroom) {
      filtered = filtered.filter(
        (t) => t.classroom?.name === selectedClassroom,
      );
    }

    setFilteredTimeins(filtered);
    setTotalPages(Math.ceil(filtered.length / pageSize));
    setPage(1);
  };

  const extractFilterOptions = () => {
    const instructors = new Set<string>();
    allTimeins.forEach((t) => {
      if (t.instructorName) instructors.add(t.instructorName);
    });
    setInstructorOptions(Array.from(instructors).sort());

    const classrooms = new Set<string>();
    allTimeins.forEach((t) => {
      if (t.classroom?.name) classrooms.add(t.classroom.name);
    });
    setClassroomOptions(Array.from(classrooms).sort());
  };

  const calculateStats = () => {
    const students = new Set<string>();
    allTimeins.forEach((t) => {
      if (t.student?.email) students.add(t.student.email);
    });
    setTotalStudents(students.size);

    const classrooms = new Set<string>();
    allTimeins.forEach((t) => {
      if (t.classroom?.name) classrooms.add(t.classroom.name);
    });
    setTotalClassrooms(classrooms.size);

    if (allTimeins.length > 0) {
      const morningCount = allTimeins.filter((t) => {
        const hour = new Date(t.timeIn).getHours();
        return hour >= 7 && hour <= 9;
      }).length;
      const percentage = Math.round((morningCount / allTimeins.length) * 100);
      setAvgTimeIn(`${percentage}% 7-9 AM`);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedMonth("");
    setSelectedInstructor("");
    setSelectedClassroom("");
    setPage(1);
  };

  const getPaginatedData = () => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredTimeins.slice(start, end);
  };

  const getStaticEvidenceUrl = (filename: string) =>
    `/uploads/evidence/${encodeURIComponent(filename)}`;

  const handleViewEvidence = async (filename: string) => {
    try {
      setEvidenceLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`/api/timein/evidence/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(response.data);
      setEvidenceModal({
        open: true,
        url,
        filename,
        isBlob: true,
      });
      setEvidenceLoading(false);
    } catch (err: unknown) {
      console.error("Error viewing evidence:", err);
      const fallbackUrl = getStaticEvidenceUrl(filename);
      setError("Unable to load evidence image. Using fallback.");
      setEvidenceModal({
        open: true,
        url: fallbackUrl,
        filename,
        isBlob: false,
      });
      setTimeout(() => setError(""), 3000);
      setEvidenceLoading(false);
    }
  };

  const closeEvidenceModal = () => {
    if (evidenceModal.url && evidenceModal.isBlob) {
      window.URL.revokeObjectURL(evidenceModal.url);
    }
    setEvidenceModal({ open: false, url: "", filename: "", isBlob: false });
  };

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem("token");

      if (filteredTimeins.length === 0) {
        setError("No data to export");
        setTimeout(() => setError(""), 3000);
        return;
      }

      setLoading(true);

      const response = await axios.post(
        "/api/reports/timein/export-pdf",
        {
          transactions: filteredTimeins,
          month: selectedMonth,
          searchQuery: searchQuery,
          instructorFilter: selectedInstructor,
          classroomFilter: selectedClassroom,
          totalRecords: filteredTimeins.length,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          responseType: "blob",
        },
      );

      const blobUrl = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" }),
      );

      const a = document.createElement("a");
      a.href = blobUrl;
      const fileName = selectedMonth
        ? `timein-${selectedMonth}${searchQuery ? `-${searchQuery}` : ""}.pdf`
        : `timein-transactions-${new Date().toISOString().split("T")[0]}.pdf`;
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);

      setSuccess("PDF downloaded successfully");
      setTimeout(() => setSuccess(""), 3000);
      setLoading(false);
    } catch (err) {
      console.error("Error downloading PDF:", err);
      setError("Failed to download PDF");
      setTimeout(() => setError(""), 3000);
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  const getClassroomDisplay = (classroom?: {
    name?: string;
    location?: string;
  }) => {
    if (!classroom) return "N/A";
    const parts = [];
    if (classroom.name) parts.push(classroom.name);
    if (classroom.location) parts.push(`(${classroom.location})`);
    return parts.length > 0 ? parts.join(" ") : "N/A";
  };

  const getStudentDisplay = (student?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }) => {
    if (!student) return "N/A";
    const name = `${student.firstName || ""} ${student.lastName || ""}`.trim();
    return name || student.email || "N/A";
  };

  const isFilteringByInstructor = selectedInstructor !== "";
  const isFilteringByClassroom = selectedClassroom !== "";
  const isSearchingForInstructor =
    searchTarget === "instructor" || searchTarget === "both";
  const isSearchingForStudent =
    searchTarget === "student" || searchTarget === "both";
  const hasActiveFilters =
    selectedInstructor !== "" ||
    selectedClassroom !== "" ||
    selectedMonth !== "" ||
    searchQuery !== "";

  const getTableHeaders = () => {
    const headers = ["Date", "Time"];

    if (isFilteringByInstructor) {
      headers.push("Instructor");
      headers.push("Student");
    } else if (isFilteringByClassroom) {
      headers.push("Classroom");
      headers.push("Student");
      headers.push("Instructor");
    } else if (isSearchingForInstructor) {
      headers.push("Instructor");
      headers.push("Student");
    } else if (isSearchingForStudent) {
      headers.push("Student");
      headers.push("Instructor");
    } else {
      headers.push("Student");
      headers.push("Instructor");
      headers.push("Classroom");
    }

    headers.push("Evidence");
    return headers;
  };

  const renderTableRow = (t: TimeInRecord) => {
    const { date, time } = formatDateTime(t.timeIn);
    const isHighlightedInstructor =
      (selectedInstructor && t.instructorName === selectedInstructor) ||
      (isSearchingForInstructor &&
        t.instructorName?.toLowerCase().includes(searchQuery.toLowerCase()));
    const isHighlightedStudent =
      isSearchingForStudent &&
      `${t.student?.firstName || ""} ${t.student?.lastName || ""}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    if (
      isFilteringByInstructor ||
      (isSearchingForInstructor && !isFilteringByClassroom)
    ) {
      return (
        <tr key={t._id}>
          <td className="date-cell">
            <span className="date-text">{date}</span>
          </td>
          <td className="time-cell">
            <span className="time-text">{time}</span>
          </td>
          <td className="instructor-cell">
            <span
              className={`instructor-badge ${isHighlightedInstructor ? "highlighted" : ""}`}
            >
              {t.instructorName || "—"}
            </span>
          </td>
          <td className="student-cell">
            <div className="student-avatar">
              {t.student?.firstName?.charAt(0) || "?"}
              {t.student?.lastName?.charAt(0) || ""}
            </div>
            <div className="student-info">
              <span
                className={`student-name ${isHighlightedStudent ? "highlighted-text" : ""}`}
              >
                {getStudentDisplay(t.student)}
              </span>
              <span className="student-email">{t.student?.email || ""}</span>
            </div>
          </td>
          <td className="classroom-cell">
            <span className="classroom-badge">
              {getClassroomDisplay(t.classroom)}
            </span>
          </td>
          <td className="evidence-cell">
            {t.evidence?.filename ? (
              <button
                className="btn-view-evidence"
                onClick={() => handleViewEvidence(t.evidence!.filename!)}
                disabled={evidenceLoading}
              >
                <Eye size={14} color="#0ec0d4" />
                View
              </button>
            ) : (
              <span className="no-evidence">—</span>
            )}
          </td>
        </tr>
      );
    } else if (
      isFilteringByClassroom ||
      (isSearchingForStudent && !isSearchingForInstructor)
    ) {
      if (isFilteringByClassroom) {
        return (
          <tr key={t._id}>
            <td className="date-cell">
              <span className="date-text">{date}</span>
            </td>
            <td className="time-cell">
              <span className="time-text">{time}</span>
            </td>
            <td className="classroom-cell">
              <span className="classroom-badge highlighted">
                {getClassroomDisplay(t.classroom)}
              </span>
            </td>
            <td className="student-cell">
              <div className="student-avatar">
                {t.student?.firstName?.charAt(0) || "?"}
                {t.student?.lastName?.charAt(0) || ""}
              </div>
              <div className="student-info">
                <span
                  className={`student-name ${isHighlightedStudent ? "highlighted-text" : ""}`}
                >
                  {getStudentDisplay(t.student)}
                </span>
                <span className="student-email">{t.student?.email || ""}</span>
              </div>
            </td>
            <td className="instructor-cell">
              <span className="instructor-badge">
                {t.instructorName || "—"}
              </span>
            </td>
            <td className="evidence-cell">
              {t.evidence?.filename ? (
                <button
                  className="btn-view-evidence"
                  onClick={() => handleViewEvidence(t.evidence!.filename!)}
                  disabled={evidenceLoading}
                >
                  <Eye size={14} color="#0ec0d4" />
                  View
                </button>
              ) : (
                <span className="no-evidence">—</span>
              )}
            </td>
          </tr>
        );
      } else {
        return (
          <tr key={t._id}>
            <td className="date-cell">
              <span className="date-text">{date}</span>
            </td>
            <td className="time-cell">
              <span className="time-text">{time}</span>
            </td>
            <td className="student-cell">
              <div className="student-avatar">
                {t.student?.firstName?.charAt(0) || "?"}
                {t.student?.lastName?.charAt(0) || ""}
              </div>
              <div className="student-info">
                <span
                  className={`student-name ${isHighlightedStudent ? "highlighted-text" : ""}`}
                >
                  {getStudentDisplay(t.student)}
                </span>
                <span className="student-email">{t.student?.email || ""}</span>
              </div>
            </td>
            <td className="instructor-cell">
              <span
                className={`instructor-badge ${isHighlightedInstructor ? "highlighted" : ""}`}
              >
                {t.instructorName || "—"}
              </span>
            </td>
            <td className="classroom-cell">
              <span className="classroom-badge">
                {getClassroomDisplay(t.classroom)}
              </span>
            </td>
            <td className="evidence-cell">
              {t.evidence?.filename ? (
                <button
                  className="btn-view-evidence"
                  onClick={() => handleViewEvidence(t.evidence!.filename!)}
                  disabled={evidenceLoading}
                >
                  <Eye size={14} color="#0ec0d4" />
                  View
                </button>
              ) : (
                <span className="no-evidence">—</span>
              )}
            </td>
          </tr>
        );
      }
    } else {
      return (
        <tr key={t._id}>
          <td className="date-cell">
            <span className="date-text">{date}</span>
          </td>
          <td className="time-cell">
            <span className="time-text">{time}</span>
          </td>
          <td className="student-cell">
            <div className="student-avatar">
              {t.student?.firstName?.charAt(0) || "?"}
              {t.student?.lastName?.charAt(0) || ""}
            </div>
            <div className="student-info">
              <span
                className={`student-name ${isHighlightedStudent ? "highlighted-text" : ""}`}
              >
                {getStudentDisplay(t.student)}
              </span>
              <span className="student-email">{t.student?.email || ""}</span>
            </div>
          </td>
          <td className="instructor-cell">
            <span
              className={`instructor-badge ${isHighlightedInstructor ? "highlighted" : ""}`}
            >
              {t.instructorName || "—"}
            </span>
          </td>
          <td className="classroom-cell">
            <span className="classroom-badge">
              {getClassroomDisplay(t.classroom)}
            </span>
          </td>
          <td className="evidence-cell">
            {t.evidence?.filename ? (
              <button
                className="btn-view-evidence"
                onClick={() => handleViewEvidence(t.evidence!.filename!)}
                disabled={evidenceLoading}
              >
                <Eye size={14} color="#0ec0d4" />
                View
              </button>
            ) : (
              <span className="no-evidence">—</span>
            )}
          </td>
        </tr>
      );
    }
  };

  return (
    <div className="reports">
      <div className="page-header">
        <div className="header-content">
          <h1>Time-In Reports</h1>
          <p className="header-description">
            View and filter all time-in transactions with real-time data
          </p>
        </div>
        <div className="header-stats">
          <div className="stat-chip">
            <span className="stat-label">Total Records</span>
            <span className="stat-value">{allTimeins.length}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Students</span>
            <span className="stat-value">{totalStudents}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Classrooms</span>
            <span className="stat-value">{totalClassrooms}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Peak Hours</span>
            <span className="stat-value">{avgTimeIn}</span>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Filters Card */}
      <div className="filters-card">
        <div className="filters-header">
          <h3>
            <Filter size={18} color="#0ec0d4" style={{ marginRight: "8px" }} />
            Filter Transactions
          </h3>
          {hasActiveFilters && (
            <button className="btn-clear-filters" onClick={handleClearFilters}>
              <X size={14} />
              Clear All Filters
            </button>
          )}
        </div>

        <div className="filters-grid">
          <div className="filter-group">
            <label>
              <Search size={14} style={{ marginRight: "4px" }} />
              Search
            </label>
            <div className="search-wrapper">
              <Search size={16} color="#0ec0d4" className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Student or instructor name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={14} color="#dc3545" />
                </button>
              )}
            </div>
          </div>

          <div className="filter-group">
            <label>
              <Calendar size={14} style={{ marginRight: "4px" }} />
              Month
            </label>
            <div className="month-input-wrapper">
              <input
                type="month"
                className="month-input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
              {selectedMonth && (
                <button
                  className="month-clear"
                  onClick={() => setSelectedMonth("")}
                  title="Clear month"
                >
                  <X size={14} color="#dc3545" />
                </button>
              )}
            </div>
          </div>

          <div className="filter-group">
            <label>
              <User size={14} style={{ marginRight: "4px" }} />
              Instructor
            </label>
            <select
              className="filter-select"
              value={selectedInstructor}
              onChange={(e) => setSelectedInstructor(e.target.value)}
            >
              <option value="">All Instructors</option>
              {instructorOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>
              <DoorOpen size={14} style={{ marginRight: "4px" }} />
              Classroom
            </label>
            <select
              className="filter-select"
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
            >
              <option value="">All Classrooms</option>
              {classroomOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Card */}
      <div className="results-card">
        <div className="results-header">
          <div className="results-title">
            <h2>
              <FileText
                size={20}
                color="#0ec0d4"
                style={{ marginRight: "8px" }}
              />
              Time-In Transactions
            </h2>
            <span className="results-count">
              {filteredTimeins.length} records found
            </span>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleDownloadPDF}
            disabled={filteredTimeins.length === 0}
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>

        {/* Active Filters Banner */}
        {hasActiveFilters && (
          <div className="active-filters-banner">
            <span className="filter-label">Active Filters:</span>
            <div className="filter-tags">
              {selectedInstructor && (
                <span className="filter-tag instructor-tag">
                  <User size={12} /> Instructor: {selectedInstructor}
                </span>
              )}
              {selectedClassroom && (
                <span className="filter-tag classroom-tag">
                  <DoorOpen size={12} /> Classroom: {selectedClassroom}
                </span>
              )}
              {selectedMonth && (
                <span className="filter-tag month-tag">
                  <Calendar size={12} /> Month:{" "}
                  {new Date(selectedMonth + "-01").toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
              {searchQuery && (
                <span className="filter-tag search-tag">
                  <Search size={12} /> Search: "{searchQuery}"
                </span>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading transactions...</p>
          </div>
        ) : filteredTimeins.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FileText size={48} color="rgba(255,255,255,0.3)" />
            </div>
            <h3>No Transactions Found</h3>
            <p>
              {hasActiveFilters
                ? "Try adjusting your filters to see more results."
                : "Time-in records will appear here."}
            </p>
            {hasActiveFilters && (
              <button className="btn btn-outline" onClick={handleClearFilters}>
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="reports-table">
                <thead>
                  <tr>
                    {getTableHeaders().map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getPaginatedData().map((t) => renderTableRow(t))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredTimeins.length > pageSize && (
              <div className="pagination-section">
                <div className="pagination-info">
                  Showing {(page - 1) * pageSize + 1} to{" "}
                  {Math.min(page * pageSize, filteredTimeins.length)} of{" "}
                  {filteredTimeins.length} records
                </div>
                <div className="pagination-controls">
                  <button
                    className="btn-pagination"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Prev
                  </button>
                  <div className="page-numbers">
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (page <= 3) pageNum = i + 1;
                      else if (page >= totalPages - 2)
                        pageNum = totalPages - 4 + i;
                      else pageNum = page - 2 + i;
                      return (
                        <button
                          key={pageNum}
                          className={`btn-page ${page === pageNum ? "active" : ""}`}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="btn-pagination"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                  <select
                    className="page-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                  >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Evidence Modal */}
      {evidenceModal.open && (
        <div className="modal-overlay" onClick={closeEvidenceModal}>
          <div
            className="modal-content evidence-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Evidence Preview</h2>
              <button className="modal-close" onClick={closeEvidenceModal}>
                <X size={20} color="#dc3545" />
              </button>
            </div>
            <div className="modal-body evidence-preview">
              <img src={evidenceModal.url} alt="Time-in evidence" />
              <p className="evidence-filename">{evidenceModal.filename}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
