import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AdminDashboard.css";
import { Clock, Users, DoorOpen, TrendingUp } from "lucide-react";

interface AdminDashboardProps {
  fullName: string;
  onLogout?: () => void;
  profilePhoto?: string;
}

interface ActivityRecord {
  _id: string;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    department: string;
    gender: "male" | "female";
  };
  classroom: {
    name: string;
    location: string;
  };
  instructorName: string;
  timeIn: string;
  timeOut?: string;
  date: string;
  isArchived?: boolean;
  evidence?: {
    filename?: string;
    originalName?: string;
  };
}

interface InstructorStats {
  instructorName: string;
  total: number;
  uniqueClassrooms: number;
  firstTimeIn?: string;
  lastTimeIn?: string;
}

interface OverallStats {
  totalToday: number;
  totalInstructors: number;
  totalClassrooms: number;
  instructors: InstructorStats[];
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ fullName }) => {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [searchName, setSearchName] = useState("");
  const [selectedInstructor, setSelectedInstructor] = useState<string>("all");
  const [evidenceModal, setEvidenceModal] = useState<{
    open: boolean;
    url: string;
    filename: string;
    isBlob?: boolean;
  }>({ open: false, url: "", filename: "", isBlob: false });
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [stats, setStats] = useState<OverallStats>({
    totalToday: 0,
    totalInstructors: 0,
    totalClassrooms: 0,
    instructors: [],
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  /**
   * Get today's date in Manila timezone (Asia/Manila)
   */
  const getManilaTodayString = () => {
    const now = new Date();
    const manilaTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Manila" }),
    );
    const year = manilaTime.getFullYear();
    const month = String(manilaTime.getMonth() + 1).padStart(2, "0");
    const day = String(manilaTime.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  /**
   * Convert UTC date to Manila date string for comparison
   */
  const convertToManilaDateString = (utcDateString: string) => {
    const date = new Date(utcDateString);
    const manilaDate = new Date(
      date.toLocaleString("en-US", { timeZone: "Asia/Manila" }),
    );
    const year = manilaDate.getFullYear();
    const month = String(manilaDate.getMonth() + 1).padStart(2, "0");
    const day = String(manilaDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const fetchRecentActivities = async () => {
    try {
      const token = localStorage.getItem("token");

      // Get today's date in Manila timezone
      const todayStr = getManilaTodayString();

      console.log("📅 Fetching Manila date:", todayStr);

      const response = await axios.get(`/api/timein?date=${todayStr}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log(`📊 API returned ${response.data.length} records`);

      // Filter using Manila date comparison
      const todayRecords = response.data.filter((record: ActivityRecord) => {
        const recordManilaDate = convertToManilaDateString(record.date);
        const isToday = recordManilaDate === todayStr;
        const notArchived = !record.isArchived;

        if (isToday && notArchived) {
          console.log(
            `✅ Record ${record._id} - Manila date: ${recordManilaDate} - INCLUDED`,
          );
        }

        return isToday && notArchived;
      });

      console.log(
        `✅ Found ${todayRecords.length} records for Manila date ${todayStr}`,
      );
      setActivities(todayRecords);
      calculateStats(todayRecords);
      setLoading(false);
      // Reset to first page when new data arrives
      setCurrentPage(1);
    } catch (error: any) {
      console.error("Error fetching activities:", error);
      if (error.response?.status === 400) {
        setError("Failed to load activities. Please refresh the page.");
      } else if (error.response?.status === 401) {
        setError("Session expired. Please login again.");
      }
      setLoading(false);
    }
  };

  const calculateStats = (records: ActivityRecord[]) => {
    // Filter out records without instructor name
    const validRecords = records.filter((record) => record.instructorName);

    const totalToday = validRecords.length;

    // Get unique classrooms used today
    const uniqueClassrooms = new Set(
      validRecords.map((r) => r.classroom?.name).filter(Boolean),
    ).size;

    // Group by instructor
    const instructorMap = new Map<
      string,
      {
        total: number;
        classrooms: Set<string>;
        firstTimeIn?: string;
        lastTimeIn?: string;
      }
    >();

    validRecords.forEach((record) => {
      const instructor = record.instructorName || "Unknown";
      const classroom = record.classroom?.name || "Unknown";
      const timeIn = record.timeIn;

      if (!instructorMap.has(instructor)) {
        instructorMap.set(instructor, {
          total: 0,
          classrooms: new Set(),
          firstTimeIn: timeIn,
          lastTimeIn: timeIn,
        });
      }

      const instructorStats = instructorMap.get(instructor)!;
      instructorStats.total += 1;
      instructorStats.classrooms.add(classroom);

      // Track first and last time-in
      if (timeIn) {
        if (
          !instructorStats.firstTimeIn ||
          timeIn < instructorStats.firstTimeIn
        ) {
          instructorStats.firstTimeIn = timeIn;
        }
        if (
          !instructorStats.lastTimeIn ||
          timeIn > instructorStats.lastTimeIn
        ) {
          instructorStats.lastTimeIn = timeIn;
        }
      }
    });

    const instructors: InstructorStats[] = Array.from(instructorMap.entries())
      .map(([instructorName, data]) => ({
        instructorName,
        total: data.total,
        uniqueClassrooms: data.classrooms.size,
        firstTimeIn: data.firstTimeIn,
        lastTimeIn: data.lastTimeIn,
      }))
      .sort((a, b) => b.total - a.total);

    setStats({
      totalToday,
      totalInstructors: instructorMap.size,
      totalClassrooms: uniqueClassrooms,
      instructors,
    });
  };

  useEffect(() => {
    fetchRecentActivities();

    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      fetchRecentActivities();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Update total pages when filtered activities change
  useEffect(() => {
    const validActivities = activities.filter(
      (activity) => activity.student && activity.classroom,
    );
    const filteredActivities = filterActivities(validActivities);
    setTotalPages(Math.ceil(filteredActivities.length / pageSize));
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [activities, searchName, selectedInstructor, pageSize]);

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
        timeZone: "Asia/Manila",
      }),
    };
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    });
  };

  const filterActivities = (activitiesList: ActivityRecord[]) => {
    return activitiesList.filter((activity) => {
      // Filter by student name
      if (searchName) {
        const fullName =
          `${activity.student?.firstName} ${activity.student?.lastName}`.toLowerCase();
        if (!fullName.includes(searchName.toLowerCase())) {
          return false;
        }
      }

      // Filter by instructor
      if (selectedInstructor !== "all") {
        if (activity.instructorName !== selectedInstructor) {
          return false;
        }
      }

      return true;
    });
  };

  const getUniqueInstructors = () => {
    const instructors = activities
      .filter((a) => a.instructorName)
      .map((a) => a.instructorName);
    return ["all", ...new Set(instructors)];
  };

  const getStaticEvidenceUrl = (fileName: string) =>
    `/uploads/evidence/${encodeURIComponent(fileName)}`;

  const handleViewEvidence = async (filename: string) => {
    if (!filename) return;
    try {
      setEvidenceLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get(`/api/timein/evidence/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(response.data);
      setEvidenceModal({ open: true, url, filename, isBlob: true });
      setEvidenceLoading(false);
    } catch (err: unknown) {
      console.error("Error viewing evidence:", err);
      const serverMessage = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined;
      if (serverMessage) {
        setError(`Unable to load evidence image: ${serverMessage}`);
      } else {
        setError("Unable to load evidence image.");
      }
      setEvidenceModal({
        open: true,
        url: getStaticEvidenceUrl(filename),
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

  useEffect(() => {
    return () => {
      if (evidenceModal.url && evidenceModal.isBlob) {
        window.URL.revokeObjectURL(evidenceModal.url);
      }
    };
  }, [evidenceModal.url, evidenceModal.isBlob]);

  // Get paginated data
  const getPaginatedData = () => {
    const validActivities = activities.filter(
      (activity) => activity.student && activity.classroom,
    );
    const filteredActivities = filterActivities(validActivities);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredActivities.slice(start, end);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of the table
    const tableContainer = document.querySelector(
      ".activities-table-container",
    );
    if (tableContainer) {
      tableContainer.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Get gender badge
  const getGenderBadge = (gender: string) => {
    if (gender === "male") {
      return <span className="badge badge-male">♂ Male</span>;
    } else if (gender === "female") {
      return <span className="badge badge-female">♀ Female</span>;
    }
    return null;
  };

  // Get current paginated data
  const currentActivities = getPaginatedData();
  const validActivities = activities.filter(
    (activity) => activity.student && activity.classroom,
  );
  const filteredActivities = filterActivities(validActivities);
  const totalFilteredCount = filteredActivities.length;

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Dashboard</h1>
          <p className="welcome-text">Welcome back, {fullName}!</p>
          <p className="date-today">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "Asia/Manila",
            })}
          </p>
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">
            <Clock size={32} color="#0ec0d4" />
          </div>
          <div className="stat-content">
            <h3>Total Time-Ins</h3>
            <p className="stat-number">{stats.totalToday}</p>
            <p className="stat-label">today</p>
          </div>
        </div>
        <div className="stat-card stat-accent">
          <div className="stat-icon">
            <Users size={32} color="#0ec0d4" />
          </div>
          <div className="stat-content">
            <h3>Active Instructors</h3>
            <p className="stat-number">{stats.totalInstructors}</p>
            <p className="stat-label">taught today</p>
          </div>
        </div>
        <div className="stat-card stat-secondary">
          <div className="stat-icon">
            <DoorOpen size={32} color="#0ec0d4" />
          </div>
          <div className="stat-content">
            <h3>Classrooms Used</h3>
            <p className="stat-number">{stats.totalClassrooms}</p>
            <p className="stat-label">utilized today</p>
          </div>
        </div>
      </div>

      {/* Instructor Statistics */}
      {stats.instructors.length > 0 && (
        <div className="department-stats-section">
          <h2>
            <TrendingUp
              size={20}
              color="#0ec0d4"
              style={{ marginRight: "8px" }}
            />
            Instructor Activity Today
          </h2>
          <div className="department-stats-grid">
            {stats.instructors.map((instructor) => (
              <div
                key={instructor.instructorName}
                className="department-stat-card"
              >
                <div className="department-header">
                  <h3>{instructor.instructorName}</h3>
                  <span className="department-percentage">
                    {instructor.total}{" "}
                    {instructor.total === 1 ? "time-in" : "time-ins"}
                  </span>
                </div>
                <div className="department-progress">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${Math.min(100, (instructor.total / stats.totalToday) * 100)}%`,
                    }}
                  ></div>
                </div>
                <div className="department-details">
                  <div className="detail-item">
                    <span className="detail-label">Classes:</span>
                    <span className="detail-value">{instructor.total}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Classrooms:</span>
                    <span className="detail-value">
                      {instructor.uniqueClassrooms}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">First In:</span>
                    <span className="detail-value">
                      {formatTime(instructor.firstTimeIn)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Last In:</span>
                    <span className="detail-value">
                      {formatTime(instructor.lastTimeIn)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activities Section */}
      <div className="activities-section">
        <div className="section-header">
          <h2>Today's Time-In Records</h2>
          <p>Real-time classroom usage and student time-in records</p>
        </div>

        <div className="filters-section">
          <div className="filter-group">
            <label>Search by Student Name:</label>
            <input
              type="text"
              placeholder="Enter student name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Filter by Instructor:</label>
            <select
              value={selectedInstructor}
              onChange={(e) => setSelectedInstructor(e.target.value)}
              className="filter-select"
            >
              {getUniqueInstructors().map((instructor) => (
                <option key={instructor} value={instructor}>
                  {instructor === "all" ? "All Instructors" : instructor}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn-clear-filters"
            onClick={() => {
              setSearchName("");
              setSelectedInstructor("all");
            }}
          >
            Clear Filters
          </button>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading activities...</p>
          </div>
        ) : (
          (() => {
            const validActivities = activities.filter(
              (activity) => activity.student && activity.classroom,
            );
            const filteredActivities = filterActivities(validActivities);

            return filteredActivities.length === 0 ? (
              <div className="no-data">
                <p>No time-in records found for today.</p>
              </div>
            ) : (
              <>
                <div className="activities-table-container">
                  <table className="activities-table">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Student Name</th>
                        <th>Department</th>
                        <th>Instructor</th>
                        <th>Classroom</th>
                        <th>Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentActivities.map((activity) => {
                        const { time } = formatDateTime(activity.timeIn);
                        return (
                          <tr key={activity._id}>
                            <td>{time}</td>
                            <td className="student-name">
                              {activity.student?.firstName}{" "}
                              {activity.student?.lastName}
                            </td>
                            <td>
                              <span className="department-badge">
                                {activity.student?.department || "N/A"}
                              </span>
                            </td>
                            <td>
                              <span className="instructor-badge">
                                {activity.instructorName || "N/A"}
                              </span>
                            </td>
                            <td>{activity.classroom?.name}</td>
                            <td>
                              {activity.evidence?.filename ? (
                                <button
                                  className="btn-view-evidence"
                                  onClick={() =>
                                    handleViewEvidence(
                                      activity.evidence!.filename!,
                                    )
                                  }
                                  disabled={evidenceLoading}
                                >
                                  {evidenceLoading ? "Loading..." : "View"}
                                </button>
                              ) : (
                                <span className="no-evidence">No evidence</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="pagination-section">
                    <div className="pagination-info">
                      Showing {(currentPage - 1) * pageSize + 1} to{" "}
                      {Math.min(currentPage * pageSize, totalFilteredCount)} of{" "}
                      {totalFilteredCount} records
                    </div>
                    <div className="pagination-controls">
                      <button
                        className="btn-pagination"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        ← Previous
                      </button>

                      <div className="page-numbers">
                        {(() => {
                          const pages: number[] = [];
                          if (totalPages <= 5) {
                            for (let i = 1; i <= totalPages; i++) {
                              pages.push(i);
                            }
                          } else if (currentPage <= 3) {
                            for (let i = 1; i <= 5; i++) {
                              pages.push(i);
                            }
                          } else if (currentPage >= totalPages - 2) {
                            for (let i = totalPages - 4; i <= totalPages; i++) {
                              pages.push(i);
                            }
                          } else {
                            for (
                              let i = currentPage - 2;
                              i <= currentPage + 2;
                              i++
                            ) {
                              pages.push(i);
                            }
                          }
                          return pages.map((pageNum) => (
                            <button
                              key={pageNum}
                              className={`btn-page ${currentPage === pageNum ? "active" : ""}`}
                              onClick={() => handlePageChange(pageNum)}
                            >
                              {pageNum}
                            </button>
                          ));
                        })()}
                      </div>

                      <button
                        className="btn-pagination"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next →
                      </button>

                      <select
                        className="page-size-select"
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setCurrentPage(1);
                        }}
                      >
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            );
          })()
        )}
      </div>

      {/* Evidence Modal */}
      {evidenceModal.open && (
        <div className="modal-overlay" onClick={closeEvidenceModal}>
          <div
            className="modal-content evidence-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={closeEvidenceModal}>
              &times;
            </button>
            <h2>Evidence Preview</h2>
            <div className="evidence-preview">
              <img src={evidenceModal.url} alt="Evidence" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
