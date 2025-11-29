import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

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

const AdminDashboard: React.FC<AdminDashboardProps> = ({ fullName }) => {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [searchName, setSearchName] = useState('');
  const [evidenceModal, setEvidenceModal] = useState<{ open: boolean; url: string; filename: string }>({ open: false, url: '', filename: '' });
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const fetchRecentActivities = async () => {
    try {
      const token = localStorage.getItem('token');
      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const response = await axios.get(`/api/timein?date=${todayStr}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter to show only today's records that are not archived
      const todayRecords = response.data.filter((record: ActivityRecord) => {
        const recordDate = new Date(record.date).toISOString().split('T')[0];
        return recordDate === todayStr && !record.isArchived;
      });
      
      setActivities(todayRecords);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching activities:', error);
      if (error.response?.status === 400) {
        setError('Failed to load activities. Please refresh the page.');
      } else if (error.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else {
        console.log('Detailed error:', error.response?.data);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivities();
    // Refresh every minute to show real-time updates
    const interval = setInterval(() => {
      fetchRecentActivities();
    }, 60000); // Refresh every 60 seconds

    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  };

  const filterActivities = (activitiesList: ActivityRecord[]) => {
    return activitiesList.filter((activity) => {
      // Filter by name only (date filtering removed - only showing today)
      if (searchName) {
        const fullName = `${activity.student?.firstName} ${activity.student?.lastName}`.toLowerCase();
        if (!fullName.includes(searchName.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  };

  const handleViewEvidence = async (filename: string) => {
    if (!filename) return;
    try {
      setEvidenceLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/timein/evidence/${filename}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(response.data);
      setEvidenceModal({ open: true, url, filename });
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

  return (
    <div className="admin-dashboard">
      <div className="dashboard-content">
        <div className="welcome-section">
          <h2>Today's Activities</h2>
          <p>Real-time daily classroom usage and time-in/out records - Updated every 24 hours</p>
          <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
            Date: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        
        {success && <div className="success-message">{success}</div>}
        {error && <div className="error-message">{error}</div>}
        
        <div className="activities-section">
          <div className="filters-section">
            <div className="filter-group">
              <label>Search by Name:</label>
              <input
                type="text"
                placeholder="Enter name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="filter-input"
              />
            </div>
            <button 
              className="btn-clear-filters"
              onClick={() => {
                setSearchName('');
              }}
            >
              Clear Filter
            </button>
          </div>

          {loading ? (
            <p>Loading activities...</p>
          ) : (() => {
            const filteredActivities = filterActivities(
              activities.filter(
                (activity) => activity.student && activity.classroom
              )
            );
            return filteredActivities.length === 0 ? (
              <p>No activities found for today.</p>
            ) : (
              <div className="activities-table-container">
                <table className="activities-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Account Name</th>
                      <th>Instructor</th>
                      <th>ComLab</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((activity) => {
                      const { date, time } = formatDateTime(activity.timeIn);
                      return (
                        <tr key={activity._id}>
                          <td>{date}</td>
                          <td>{time}</td>
                          <td>{activity.student?.firstName} {activity.student?.lastName}</td>
                          <td>{activity.instructorName || 'N/A'}</td>
                          <td>{activity.classroom?.name}</td>
                          <td>
                            {activity.evidence?.filename ? (
                              <button
                                className="btn-link"
                                onClick={() => handleViewEvidence(activity.evidence!.filename!)}
                                disabled={evidenceLoading}
                              >
                                {evidenceLoading ? 'Loading...' : 'View Evidence'}
                              </button>
                            ) : (
                              <span style={{ color: '#6c757d' }}>No evidence</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            );
          })()}
        </div>
      </div>

      {evidenceModal.open && (
        <div className="modal-overlay" onClick={closeEvidenceModal}>
          <div className="modal-content evidence-modal" onClick={(e) => e.stopPropagation()}>
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


