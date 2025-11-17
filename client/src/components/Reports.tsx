import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Reports.css';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'student' | 'admin' | 'teacher';
  employeeId: string;
  department: string;
}

interface Report {
  _id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'teacher' | 'admin' | 'utilization' | 'semester';
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
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [dailyTimeins, setDailyTimeins] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [comment, setComment] = useState('');
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [evidenceModal, setEvidenceModal] = useState<{ open: boolean; url: string; filename: string }>({
    open: false,
    url: '',
    filename: ''
  });
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // Reports fetching disabled to avoid heavy queries/timeouts; showing only date-based transactions

  useEffect(() => {
    if (selectedDate) {
      fetchDailyTimeins(selectedDate);
    } else {
      setDailyTimeins([]);
    }
  }, [selectedDate]);

  const fetchDailyTimeins = async (dateISO: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/timein?date=${dateISO}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDailyTimeins(response.data || []);
    } catch (error: any) {
      console.error('Error fetching time-in transactions:', error);
      setError('Failed to load transactions for the selected day');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleViewEvidence = async (filename: string) => {
    try {
      setEvidenceLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/timein/evidence/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      setEvidenceModal({
        open: true,
        url,
        filename
      });
      setEvidenceLoading(false);
    } catch (err) {
      console.error('Error viewing evidence:', err);
      setError('Unable to load evidence image.');
      setTimeout(() => setError(''), 3000);
      setEvidenceLoading(false);
    }
  };

  const closeEvidenceModal = () => {
    if (evidenceModal.url) {
      window.URL.revokeObjectURL(evidenceModal.url);
    }
    setEvidenceModal({ open: false, url: '', filename: '' });
  };

  useEffect(() => {
    return () => {
      if (evidenceModal.url) {
        window.URL.revokeObjectURL(evidenceModal.url);
      }
    };
  }, [evidenceModal.url]);

  const handleExportPDF = async (reportId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/reports/${reportId}/export-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      // Create blob and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccess('Report exported successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      setError('Failed to export PDF');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAddComment = async (reportId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `/api/reports/${reportId}/comment`,
        { comment },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccess('Comment added successfully');
      setShowCommentModal(false);
      setComment('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      console.error('Error adding comment:', error);
      setError('Failed to add comment');
      setTimeout(() => setError(''), 3000);
    }
  };

  const openCommentModal = (report: Report) => {
    setSelectedReport(report);
    setComment(report.comment || '');
    setShowCommentModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getWeekOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let week = 1; week <= 52; week++) {
      options.push(`${currentYear}-${week.toString().padStart(2, '0')}`);
    }
    return options;
  };

  const getMonthOptions = () => {
    const options = [];
    const currentYear = new Date().getFullYear();
    for (let month = 1; month <= 12; month++) {
      options.push(`${currentYear}-${month.toString().padStart(2, '0')}`);
    }
    return options;
  };

  const filteredReports = reports;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="reports">
      <div className="page-header">
        <h1>Reports</h1>
        <p>View and export weekly and monthly reports with archived daily data</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="reports-filters">
        <div className="filter-group">
          <label>Select Date:</label>
          <input
            type="date"
            className="filter-select"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {selectedDate && (
        <div className="reports-list" style={{ marginBottom: 24 }}>
          <div className="report-card">
            <div className="report-header">
              <h3>Time-in Transactions on {formatDate(selectedDate)}</h3>
              <span className="report-type daily">TRANSACTIONS</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <button
                className="btn-export"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const resp = await axios.get(`/api/timein/export/pdf?date=${selectedDate}`, {
                      headers: { Authorization: `Bearer ${token}` },
                      responseType: 'blob'
                    });
                    const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `timein-${selectedDate}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error('Error downloading PDF:', err);
                    setError('Failed to download PDF.');
                    setTimeout(() => setError(''), 3000);
                  }
                }}
              >
                Download PDF
              </button>
            </div>
            {dailyTimeins.length === 0 ? (
              <p>No transactions recorded for this date.</p>
            ) : (
              <div className="report-details">
                <div className="report-info">
                  {dailyTimeins.map((t: any) => (
                    <div key={t._id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <p><strong>Classroom:</strong> {t.classroom?.name} ({t.classroom?.location})</p>
                      <p><strong>Instructor:</strong> {t.instructorName}</p>
                      <p><strong>Time In:</strong> {t.timeIn ? new Date(t.timeIn).toLocaleTimeString() : '—'}
                        {t.timeOut ? `  |  Time Out: ${new Date(t.timeOut).toLocaleTimeString()}` : ''}
                      </p>
                      {t.evidence?.filename && (
                        <button
                          onClick={() => handleViewEvidence(t.evidence.filename)}
                          className="btn-link"
                          style={{ marginTop: 4 }}
                          disabled={evidenceLoading}
                        >
                          {evidenceLoading ? 'Loading...' : 'View Evidence'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="reports-list">
        {filteredReports.length > 0 && (
          filteredReports.map((report) => (
            <div key={report._id} className="report-card">
              <div className="report-header">
                <h3>{report.title}</h3>
                <span className={`report-type ${report.type}`}>{report.type.toUpperCase()}</span>
              </div>

              <div className="report-details">
                <div className="report-info">
                  <p><strong>Period:</strong> {formatDate(report.period.startDate)} - {formatDate(report.period.endDate)}</p>
                  <p><strong>Generated By:</strong> {report.generatedBy.firstName} {report.generatedBy.lastName}</p>
                  <p><strong>Generated On:</strong> {formatDate(report.createdAt)}</p>
                  <p><strong>Status:</strong> <span className={`status-${report.status}`}>{report.status}</span></p>
                </div>

                {report.data && report.data.statistics && (
                  <div className="report-statistics">
                    <h4>Statistics</h4>
                    <div className="stats-grid">
                      <div className="stat-item">
                        <span className="stat-label">Total Records:</span>
                        <span className="stat-value">{report.data.statistics.totalRecords || 0}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Verified:</span>
                        <span className="stat-value">{report.data.statistics.verifiedRecords || 0}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Pending:</span>
                        <span className="stat-value">{report.data.statistics.pendingRecords || 0}</span>
                      </div>
                      {report.data.statistics.verificationRate !== undefined && (
                        <div className="stat-item">
                          <span className="stat-label">Verification Rate:</span>
                          <span className="stat-value">{report.data.statistics.verificationRate}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {report.summary && (
                  <div className="report-summary">
                    <h4>Summary</h4>
                    <p>Total Classrooms: {report.summary.totalClassrooms || 0}</p>
                    <p>Total Utilization: {report.summary.totalUtilization || 0}</p>
                    {report.summary.averageUtilization !== undefined && (
                      <p>Average Utilization: {report.summary.averageUtilization}%</p>
                    )}
                  </div>
                )}

                {report.comment && (
                  <div className="report-comment">
                    <h4>Comments</h4>
                    <p>{report.comment}</p>
                  </div>
                )}
              </div>

              <div className="report-actions">
                <button
                  className="btn-export"
                  onClick={() => handleExportPDF(report._id)}
                >
                  Export PDF
                </button>
                <button
                  className="btn-comment"
                  onClick={() => openCommentModal(report)}
                >
                  {report.comment ? 'Edit Comment' : 'Add Comment'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCommentModal && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowCommentModal(false)}>
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
                  setComment('');
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
          <div className="modal-content evidence-modal" onClick={(e) => e.stopPropagation()}>
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
