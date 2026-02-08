import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Reports.css";

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

interface ReportsProps {
  user: User;
}

const Reports: React.FC<ReportsProps> = ({ user }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [allTimeins, setAllTimeins] = useState<any[]>([]);
  const [filteredTimeins, setFilteredTimeins] = useState<any[]>([]);
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchTimeins = async (monthISO?: string) => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No auth token");

      const params: any = {};
      if (monthISO) {
        params.month = monthISO; // send as month instead of start/end dates
      }
      if (searchQuery) {
        params.studentName = searchQuery;
        params.instructorName = searchQuery;
      }

      const response = await axios.get("/api/reports/timein/all", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setAllTimeins(response.data || []);
    } catch (err: any) {
      console.error("Error fetching time-ins:", err);
      setError(err.response?.data?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = [...allTimeins];

    // Apply month filter
    if (selectedMonth) {
      const [year, monthNum] = selectedMonth.split("-");
      filtered = filtered.filter((t: any) => {
        const d = new Date(t.date);
        return (
          d.getFullYear() === Number(year) &&
          d.getMonth() + 1 === Number(monthNum)
        );
      });
    }

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((t: any) => {
        const studentName =
          `${t.student?.firstName || ""} ${t.student?.lastName || ""}`.toLowerCase();
        const instructorName = (t.instructorName || "").toLowerCase();
        return studentName.includes(query) || instructorName.includes(query);
      });
    }

    setFilteredTimeins(filtered);
    setPage(1);
  }, [allTimeins, searchQuery, selectedMonth]);

  useEffect(() => {
    fetchTimeins(selectedMonth || undefined);
  }, [selectedMonth]);

  const totalPages = Math.max(1, Math.ceil(filteredTimeins.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedTimeins = filteredTimeins.slice(
    (currentPage - 1) * pageSize,
    (currentPage - 1) * pageSize + pageSize,
  );

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

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      setEvidenceModal({
        open: true,
        url,
        filename,
        isBlob: true,
      });
      setEvidenceLoading(false);
    } catch (err: unknown) {
      console.error("Error viewing evidence:", err);
      const serverMessage = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined;
      const fallbackUrl = getStaticEvidenceUrl(filename);
      if (serverMessage) {
        setError(`Unable to load evidence image: ${serverMessage}`);
      } else {
        setError("Unable to load evidence image.");
      }
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

  useEffect(() => {
    return () => {
      if (evidenceModal.url && evidenceModal.isBlob) {
        window.URL.revokeObjectURL(evidenceModal.url);
      }
    };
  }, [evidenceModal.url, evidenceModal.isBlob]);

  const handleExportPDF = async (reportId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`/api/reports/${reportId}/export-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `report-${reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccess("Report exported successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      setError("Failed to export PDF");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleAddComment = async (reportId: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `/api/reports/${reportId}/comment`,
        { comment },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setSuccess("Comment added successfully");
      setShowCommentModal(false);
      setComment("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      console.error("Error adding comment:", error);
      setError("Failed to add comment");
      setTimeout(() => setError(""), 3000);
    }
  };

  const openCommentModal = (report: Report) => {
    setSelectedReport(report);
    setComment(report.comment || "");
    setShowCommentModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="reports">
      <div className="page-header">
        <h1>Reports</h1>
        <p>
          View all time-in transactions (latest to oldest). Use filters to
          search and narrow down results.
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="reports-filters">
        <div className="filter-group">
          <label>Search by Student or Instructor Name:</label>
          <input
            type="text"
            className="filter-select"
            placeholder="Enter name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Filter by Month (Optional):</label>
          <input
            type="month"
            className="filter-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          {selectedMonth && (
            <button
              className="btn-clear-filter"
              onClick={() => setSelectedMonth("")}
              style={{ marginLeft: "8px", padding: "6px 12px" }}
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading transactions...</p>
        </div>
      ) : (
        <div className="reports-list">
          <div className="report-card">
            <div className="report-header">
              <h3>
                Time-in Transactions
                {selectedMonth
                  ? ` for ${new Date(selectedMonth + "-01").toLocaleDateString("en-US", { year: "numeric", month: "long" })}`
                  : " (All Transactions)"}
                {searchQuery && ` - Search: "${searchQuery}"`}
              </h3>
              <span className="report-type daily">TRANSACTIONS</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <button
                className="btn-export"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem("token");

                    const resp = await axios.get(
                      "/api/reports/timein/export-pdf",
                      {
                        headers: { Authorization: `Bearer ${token}` },
                        responseType: "blob",
                        params: {
                          month: selectedMonth || undefined,
                          studentName: searchQuery || undefined,
                          instructorName: searchQuery || undefined,
                        },
                      },
                    );

                    const blobUrl = window.URL.createObjectURL(
                      new Blob([resp.data], { type: "application/pdf" }),
                    );

                    const a = document.createElement("a");
                    a.href = blobUrl;
                    a.download = selectedMonth
                      ? `timein-${selectedMonth}.pdf`
                      : "timein-transactions.pdf";

                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(blobUrl);

                    setSuccess("PDF downloaded successfully");
                    setTimeout(() => setSuccess(""), 3000);
                  } catch (err) {
                    console.error("Error downloading PDF:", err);
                    setError("Failed to download PDF");
                    setTimeout(() => setError(""), 3000);
                  }
                }}
              >
                Download PDF
              </button>
            </div>
            {filteredTimeins.length === 0 ? (
              <p>
                No transactions found{selectedMonth ? " for this month" : ""}
                {searchQuery ? ` matching "${searchQuery}"` : ""}.
              </p>
            ) : (
              <div className="report-details">
                <div className="report-info">
                  <p style={{ marginBottom: "12px", color: "#666" }}>
                    <strong>
                      Total Transactions: {filteredTimeins.length}
                    </strong>
                  </p>
                  <div className="table-responsive">
                    <table className="reports-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Classroom</th>
                          <th>Student</th>
                          <th>Instructor</th>
                          <th>Time In</th>
                          {/* <th>Time Out</th> */}
                          <th>Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTimeins.map((t: any) => (
                          <tr key={t._id}>
                            <td>
                              {t.date
                                ? new Date(t.date).toLocaleDateString()
                                : "—"}
                            </td>
                            <td>
                              {t.classroom?.name} ({t.classroom?.location})
                            </td>
                            <td>
                              {t.student?.firstName} {t.student?.lastName}
                            </td>
                            <td>{t.instructorName}</td>
                            <td>
                              {t.timeIn
                                ? new Date(t.timeIn).toLocaleTimeString()
                                : "—"}
                            </td>
                            {/* <td>
                              {t.timeOut
                                ? new Date(t.timeOut).toLocaleTimeString()
                                : "—"}
                            </td> */}
                            <td>
                              {t.evidence?.filename ? (
                                <button
                                  onClick={() =>
                                    handleViewEvidence(t.evidence.filename)
                                  }
                                  className="btn-link"
                                  disabled={evidenceLoading}
                                >
                                  {evidenceLoading ? "Loading..." : "View"}
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
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
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
          </div>
        </div>
      )}

      {showCommentModal && selectedReport && (
        <div
          className="modal-overlay"
          onClick={() => setShowCommentModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Comment to Report</h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter your comment here..."
              rows={6}
              className="comment-textarea"
            />
            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowCommentModal(false);
                  setComment("");
                }}
              >
                Cancel
              </button>
              <button
                className="btn-save"
                onClick={() => handleAddComment(selectedReport._id)}
              >
                Save Comment
              </button>
            </div>
          </div>
        </div>
      )}

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
              <img src={evidenceModal.url} alt="Time-in evidence" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
