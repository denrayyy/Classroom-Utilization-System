import React, { useEffect, useState } from "react";
import axios from "axios";
import "./ActivityLogs.css";
import {
  Search,
  Filter,
  X,
  Plus,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  ClipboardList,
  User,
  Building,
  Users,
  Calendar,
  Clock,
  FileText,
  Eye,
  ChevronRight,
  Mail,
  MapPin,
} from "lucide-react";

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher";
}

interface ActivityLog {
  _id: string;
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
  };
  action: "create" | "update" | "delete" | "archive" | "restore";
  entityType: string;
  entityName: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface ActivityLogsProps {
  user: User;
}

const ActivityLogs: React.FC<ActivityLogsProps> = ({ user }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [entityTypes, setEntityTypes] = useState<string[]>(["all"]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const fetchEntityTypes = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/activity-logs/entity-types", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntityTypes(["all", ...response.data]);
    } catch (error) {
      console.error("Error fetching entity types:", error);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      const params: any = {
        page,
        limit: pageSize,
      };

      if (searchQuery) params.search = searchQuery;
      if (selectedAction !== "all") params.action = selectedAction;
      if (selectedEntity !== "all") params.entityType = selectedEntity;
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;

      const response = await axios.get("/api/activity-logs", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (response.data.logs) {
        setLogs(response.data.logs);
        setTotalPages(response.data.pagination?.pages || 1);
        setTotalLogs(response.data.pagination?.total || 0);
      } else if (Array.isArray(response.data)) {
        setLogs(response.data);
        setTotalPages(1);
        setTotalLogs(response.data.length);
      } else {
        setLogs([]);
        setTotalPages(1);
        setTotalLogs(0);
      }

      setError("");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load activity logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntityTypes();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [
    page,
    pageSize,
    selectedAction,
    selectedEntity,
    dateRange.start,
    dateRange.end,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== undefined) {
        setPage(1);
        fetchLogs();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedAction("all");
    setSelectedEntity("all");
    setDateRange({ start: "", end: "" });
    setPage(1);
  };

  const openModal = (log: ActivityLog) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  const closeModal = () => {
    setSelectedLog(null);
    setModalOpen(false);
  };

  const getActionBadge = (action: string) => {
    const badges: Record<string, { class: string; icon: React.ReactNode }> = {
      create: { class: "badge-create", icon: <Plus size={12} /> },
      update: { class: "badge-update", icon: <Pencil size={12} /> },
      delete: { class: "badge-delete", icon: <Trash2 size={12} /> },
      archive: { class: "badge-archive", icon: <Archive size={12} /> },
      restore: { class: "badge-restore", icon: <RotateCcw size={12} /> },
    };
    const badge = badges[action] || {
      class: "badge-default",
      icon: <ClipboardList size={12} />,
    };

    return (
      <span className={`badge-action ${badge.class}`}>
        <span className="action-icon">{badge.icon}</span>
        <span className="action-text">{action}</span>
      </span>
    );
  };

  const getEntityIcon = (entityType: string) => {
    const icons: Record<string, React.ReactNode> = {
      User: <User size={14} />,
      Classroom: <Building size={14} />,
      Instructor: <Users size={14} />,
      Schedule: <Calendar size={14} />,
      TimeIn: <Clock size={14} />,
      Report: <FileText size={14} />,
    };
    return icons[entityType] || <ClipboardList size={14} />;
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
        second: "2-digit",
        hour12: true,
      }),
    };
  };

  const formatChanges = (changes: any) => {
    if (!changes) return null;

    return Object.entries(changes).map(([field, value]: [string, any]) => (
      <div key={field} className="change-item">
        <div className="change-field">{field}</div>
        <div className="change-values">
          <span className="change-old">
            {value.old !== undefined ? String(value.old) : "—"}
          </span>
          <ChevronRight size={14} className="change-arrow" />
          <span className="change-new">
            {value.new !== undefined ? String(value.new) : "—"}
          </span>
        </div>
      </div>
    ));
  };

  return (
    <div className="activity-logs">
      <div className="page-header">
        <div className="header-content">
          <h1>Activity Logs / Audit Trail</h1>
          <p className="header-description">
            Monitor all system activities, user actions, and data changes
          </p>
        </div>
        <div className="header-stats">
          <div className="stat-item">
            <span className="stat-label">Total Logs</span>
            <span className="stat-value">{totalLogs}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Page</span>
            <span className="stat-value">
              {page} / {totalPages}
            </span>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Filters Section */}
      <div className="filters-card">
        <div className="filters-header">
          <h3>
            <Filter size={18} color="#0ec0d4" style={{ marginRight: "8px" }} />
            Filter Logs
          </h3>
          <button className="btn-clear-filters" onClick={clearFilters}>
            <X size={14} />
            Clear All Filters
          </button>
        </div>

        <div className="filters-grid">
          <div className="filter-group">
            <label>
              <Search size={14} style={{ marginRight: "4px" }} />
              Search
            </label>
            <input
              type="text"
              className="filter-input"
              placeholder="Search by user, entity, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>
              <Filter size={14} style={{ marginRight: "4px" }} />
              Action
            </label>
            <select
              className="filter-select"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
            >
              <option value="all">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="archive">Archive</option>
              <option value="restore">Restore</option>
            </select>
          </div>

          <div className="filter-group">
            <label>
              <ClipboardList size={14} style={{ marginRight: "4px" }} />
              Module
            </label>
            <select
              className="filter-select"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              {entityTypes.map((type: string) => (
                <option key={type} value={type}>
                  {type === "all" ? "All Modules" : type}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>
              <Calendar size={14} style={{ marginRight: "4px" }} />
              Date Range
            </label>
            <div className="date-range">
              <input
                type="date"
                className="filter-input"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange({ ...dateRange, start: e.target.value })
                }
                placeholder="Start"
              />
              <ChevronRight size={14} className="date-separator" />
              <input
                type="date"
                className="filter-input"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange({ ...dateRange, end: e.target.value })
                }
                placeholder="End"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading activity logs...</p>
        </div>
      ) : (
        <div className="logs-card">
          {logs.length === 0 ? (
            <div className="no-data">
              <div className="no-data-icon">
                <ClipboardList size={48} color="rgba(255,255,255,0.3)" />
              </div>
              <h3>No Activity Logs Found</h3>
              <p>
                {searchQuery ||
                selectedAction !== "all" ||
                selectedEntity !== "all" ||
                dateRange.start
                  ? "Try adjusting your filters to see more results."
                  : "Activity logs will appear here as users interact with the system."}
              </p>
              {(searchQuery ||
                selectedAction !== "all" ||
                selectedEntity !== "all" ||
                dateRange.start) && (
                <button className="btn-clear-filters" onClick={clearFilters}>
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Module</th>
                      <th>Entity</th>
                      <th>Changes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log: ActivityLog) => {
                      const { date, time } = formatDateTime(log.createdAt);
                      return (
                        <tr key={log._id} className="log-row">
                          <td className="timestamp-cell">
                            <div className="timestamp-date">{date}</div>
                            <div className="timestamp-time">{time}</div>
                          </td>
                          <td className="user-cell">
                            <div className="user-avatar">
                              {log.user.firstName.charAt(0)}
                              {log.user.lastName.charAt(0)}
                            </div>
                            <div className="user-info">
                              <div className="user-name">
                                {log.user.firstName} {log.user.lastName}
                              </div>
                              <div className="user-email">
                                <Mail
                                  size={10}
                                  style={{ marginRight: "4px" }}
                                />
                                {log.user.email}
                              </div>
                            </div>
                          </td>
                          <td>{getActionBadge(log.action)}</td>
                          <td>
                            <span className="entity-badge">
                              <span className="entity-icon">
                                {getEntityIcon(log.entityType)}
                              </span>
                              <span className="entity-type">
                                {log.entityType}
                              </span>
                            </span>
                          </td>
                          <td className="entity-name-cell">
                            <span
                              className="entity-name"
                              title={log.entityName}
                            >
                              {log.entityName}
                            </span>
                          </td>
                          <td>
                            {log.changes ? (
                              <button
                                className="btn-view-changes"
                                onClick={() => openModal(log)}
                                title="View detailed changes"
                              >
                                <Eye size={14} color="#0ec0d4" />
                                View
                              </button>
                            ) : (
                              <span className="no-changes">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination-section">
                  <div className="pagination-info">
                    Showing {(page - 1) * pageSize + 1} to{" "}
                    {Math.min(page * pageSize, totalLogs)} of {totalLogs} logs
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="btn-pagination"
                      disabled={page <= 1}
                      onClick={() => setPage((p: number) => p - 1)}
                    >
                      ← Prev
                    </button>
                    <div className="page-numbers">
                      {[...Array(Math.min(5, totalPages))].map(
                        (_, i: number) => {
                          const pageNum: number = (() => {
                            if (totalPages <= 5) return i + 1;
                            if (page <= 3) return i + 1;
                            if (page >= totalPages - 2)
                              return totalPages - 4 + i;
                            return page - 2 + i;
                          })();

                          return (
                            <button
                              key={pageNum}
                              className={`btn-page ${page === pageNum ? "active" : ""}`}
                              onClick={() => setPage(pageNum)}
                            >
                              {pageNum}
                            </button>
                          );
                        },
                      )}
                    </div>
                    <button
                      className="btn-pagination"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p: number) => p + 1)}
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
      )}

      {/* Changes Modal */}
      {modalOpen && selectedLog && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content changes-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Detailed Changes</h2>
              <button className="modal-close-btn" onClick={closeModal}>
                <X size={20} color="#dc3545" />
              </button>
            </div>

            <div className="modal-body">
              <div className="change-summary">
                <div className="summary-item">
                  <span className="summary-label">Entity</span>
                  <span className="summary-value">
                    <span className="entity-icon">
                      {getEntityIcon(selectedLog.entityType)}
                    </span>
                    {selectedLog.entityType}: {selectedLog.entityName}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Action</span>
                  <span className="summary-value">
                    {getActionBadge(selectedLog.action)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">User</span>
                  <span className="summary-value">
                    {selectedLog.user.firstName} {selectedLog.user.lastName}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Time</span>
                  <span className="summary-value">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </span>
                </div>
                {selectedLog.ipAddress && (
                  <div className="summary-item">
                    <span className="summary-label">
                      <MapPin size={12} style={{ marginRight: "4px" }} />
                      IP Address
                    </span>
                    <span className="summary-value">
                      {selectedLog.ipAddress}
                    </span>
                  </div>
                )}
              </div>

              <div className="changes-section">
                <h3>Changes Made</h3>
                <div className="changes-list">
                  {formatChanges(selectedLog.changes) || (
                    <div className="no-changes-message">
                      No detailed changes recorded
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
