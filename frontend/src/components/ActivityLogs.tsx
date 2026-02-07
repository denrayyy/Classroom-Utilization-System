import React, { useEffect, useState } from "react";
import axios from "axios";
import "./Reports.css";

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
    firstName: string;
    lastName: string;
    email: string;
  };
  action: "create" | "update" | "delete";
  entityType: string;
  entityName: string;
  changes?: any;
  ipAddress?: string;
  createdAt: string;
}

interface ActivityLogsProps {
  user: User;
}

const ActivityLogs: React.FC<ActivityLogsProps> = ({ user }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/activity-logs", {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Activity Logs API Response:", response.data); // <-- add this

      // temporary set all response data to logs just to see
      setLogs(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load activity logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs by search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredLogs(logs);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredLogs(
        logs.filter(
          (log) =>
            log.user.firstName.toLowerCase().includes(query) ||
            log.user.lastName.toLowerCase().includes(query) ||
            log.entityType.toLowerCase().includes(query) ||
            log.entityName.toLowerCase().includes(query),
        ),
      );
    }
    setPage(1);
  }, [logs, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    (currentPage - 1) * pageSize + pageSize,
  );

  const openModal = (log: ActivityLog) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  const closeModal = () => {
    setSelectedLog(null);
    setModalOpen(false);
  };

  return (
    <div className="reports">
      <div className="page-header">
        <h1>Activity Logs / Audit Trail</h1>
        <p>Activity Monitoring</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="reports-filters">
        <div className="filter-group">
          <label>Search by User or Entity:</label>
          <input
            type="text"
            className="filter-select"
            placeholder="Enter name, module, or entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading logs...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <p>
          No activity logs found
          {searchQuery ? ` matching "${searchQuery}"` : ""}.
        </p>
      ) : (
        <div className="reports-list">
          <div className="report-card">
            <div className="table-responsive">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Module</th>
                    <th>Entity</th>
                    <th>View Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => (
                    <tr key={log._id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>
                        {log.user.firstName} {log.user.lastName}
                      </td>
                      <td>{log.action}</td>
                      <td>{log.entityType}</td>
                      <td>{log.entityName}</td>
                      <td>
                        {log.changes ? (
                          <button
                            className="btn-link"
                            onClick={() => openModal(log)}
                          >
                            View
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                className="btn btn-outline"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span style={{ padding: "0 12px" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn btn-outline"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value, 10));
                  setPage(1);
                }}
                style={{ marginLeft: "12px" }}
              >
                {[5, 10, 20, 50].map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {modalOpen && selectedLog && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              ×
            </button>
            <h2>Changes</h2>
            <pre>{JSON.stringify(selectedLog.changes, null, 2)}</pre>
            <p>
              <strong>IP:</strong> {selectedLog.ipAddress || "N/A"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogs;
