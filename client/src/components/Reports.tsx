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
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allTimeins, setAllTimeins] = useState<any[]>([]);
  const [filteredTimeins, setFilteredTimeins] = useState<any[]>([]);
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

  const fetchAllTimeins = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/reports/timein/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllTimeins(response.data || []);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching all time-in transactions:', error);
      setError('Failed to load all transactions');
      setLoading(false);
      setTimeout(() => setError(''), 3000);
    }
  };

  const fetchMonthlyTimeins = async (monthISO: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      // monthISO is in format "YYYY-MM"
      const [year, month] = monthISO.split('-');
      
      // Create start and end dates for the month
      const startDate = new Date(parseInt(year), parseInt(month) - 1, 1); // Month is 0-indexed
      const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999); // Last day of month
      
      console.log('Fetching transactions for month:', monthISO);
      console.log('Date range:', startDate, 'to', endDate);
      
      // Fetch all transactions from the database
      const response = await axios.get(
        `/api/reports/timein/all`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      console.log('Total transactions fetched:', response.data?.length || 0);
      
      // Filter transactions for the selected month on client side
      const monthTransactions = (response.data || []).filter((t: any) => {
        const transactionDate = new Date(t.date);
        // Ensure we're comparing dates correctly
        const isInMonth = transactionDate >= startDate && transactionDate <= endDate;
        return isInMonth;
      });
      
      console.log('Transactions in selected month:', monthTransactions.length);
      setAllTimeins(monthTransactions);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching monthly transactions:', error);
      setError('Failed to load transactions for the selected month');
      setLoading(false);
      setTimeout(() => setError(''), 3000);
    }
  };

  // Apply search filter whenever allTimeins or searchQuery changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTimeins(allTimeins);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = allTimeins.filter((t: any) => {
        const studentName = `${t.student?.firstName || ''} ${t.student?.lastName || ''}`.toLowerCase();
        const instructorName = (t.instructorName || '').toLowerCase();
        return studentName.includes(query) || instructorName.includes(query);
      });
      setFilteredTimeins(filtered);
    }
  }, [allTimeins, searchQuery]);

  // Fetch all time-in transactions on component mount
  useEffect(() => {
    fetchAllTimeins();
  }, []);

  // When month is selected, filter the transactions
  // When month is cleared, show all transactions
  useEffect(() => {
    if (selectedMonth) {
      fetchMonthlyTimeins(selectedMonth);
    } else {
      fetchAllTimeins();
    }
  }, [selectedMonth]);

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

  return (
    <div className="reports">
      <div className="page-header">
        <h1>Reports</h1>
        <p>View all time-in transactions (latest to oldest). Use filters to search and narrow down results.</p>
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
              onClick={() => setSelectedMonth('')}
              style={{ marginLeft: '8px', padding: '6px 12px' }}
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
                {selectedMonth ? ` for ${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}` : ' (All Transactions)'}
                {searchQuery && ` - Search: "${searchQuery}"`}
              </h3>
              <span className="report-type daily">TRANSACTIONS</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <button
                className="btn-export"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    // Build URL based on what's displayed
                    let url = `/api/timein/export/pdf`;
                    if (selectedMonth) {
                      // Export entire month - send date as YYYY-MM-01
                      url += `?date=${selectedMonth}-01`;
                    }
                    // If no month selected, export all transactions (no date param)
                    
                    const resp = await axios.get(url, {
                      headers: { Authorization: `Bearer ${token}` },
                      responseType: 'blob'
                    });
                    const blobUrl = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = selectedMonth ? `timein-${selectedMonth}.pdf` : `timein-all-transactions.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(blobUrl);
                    setSuccess('PDF downloaded successfully');
                    setTimeout(() => setSuccess(''), 3000);
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
            {filteredTimeins.length === 0 ? (
              <p>No transactions found{selectedMonth ? ' for this month' : ''}
                {searchQuery ? ` matching "${searchQuery}"` : ''}.
              </p>
            ) : (
              <div className="report-details">
                <div className="report-info">
                  <p style={{ marginBottom: '12px', color: '#666' }}>
                    <strong>Total Transactions: {filteredTimeins.length}</strong>
                  </p>
                  {filteredTimeins.map((t: any) => (
                    <div key={t._id} style={{ padding: '12px', borderBottom: '1px solid #f0f0f0', marginBottom: '8px' }}>
                      <p><strong>Date:</strong> {t.date ? new Date(t.date).toLocaleDateString() : '—'}</p>
                      <p><strong>Classroom:</strong> {t.classroom?.name} ({t.classroom?.location})</p>
                      <p><strong>Student:</strong> {t.student?.firstName} {t.student?.lastName}</p>
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
