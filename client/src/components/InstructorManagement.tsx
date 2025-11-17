import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ClassroomManagement.css';

interface Instructor {
  _id: string;
  name: string;
}

interface InstructorManagementProps {
  user: { id: string };
}

const InstructorManagement: React.FC<InstructorManagementProps> = ({ user }) => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [newInstructorName, setNewInstructorName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/instructors');
      setInstructors(response.data);
    } catch (error: any) {
      setError('Failed to fetch instructors');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newInstructorName.trim()) {
      setError('Instructor name is required');
      return;
    }

    try {
      await axios.post('/api/instructors', { name: newInstructorName.trim() });
      setNewInstructorName('');
      setShowInstructorForm(false);
      fetchInstructors();
      setSuccess('Instructor added successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to add instructor');
    }
  };

  const handleDeleteInstructor = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await axios.delete(`/api/instructors/${id}`);
        fetchInstructors();
        setSuccess('Instructor deleted successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } catch (error: any) {
        setError(error.response?.data?.message || 'Failed to delete instructor');
      }
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="classroom-management">
      <div className="page-header">
        <h1>Manage Instructors</h1>
        <p>Add, view, and delete instructor names for time-in forms</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>Instructors</h2>
          {!showInstructorForm && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setNewInstructorName('');
                setError('');
                setShowInstructorForm(true);
              }}
            >
              Add Instructor
            </button>
          )}
        </div>

        {showInstructorForm && (
          <form onSubmit={handleAddInstructor} className="classroom-form">
            <h3>Add New Instructor</h3>
            
            <div className="form-group">
              <label htmlFor="instructorName">Instructor Name</label>
              <input
                type="text"
                id="instructorName"
                value={newInstructorName}
                onChange={(e) => setNewInstructorName(e.target.value)}
                placeholder="Enter instructor's full name"
                required
              />
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowInstructorForm(false);
                  setNewInstructorName('');
                  setError('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Add Instructor
              </button>
            </div>
          </form>
        )}

        {!showInstructorForm && (
          <div className="users-table">
            {instructors.length === 0 ? (
              <div className="no-classrooms">
                <p>No instructors found. Add your first instructor to get started.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Instructor Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {instructors.map((instructor) => (
                    <tr key={instructor._id}>
                      <td>{instructor.name}</td>
                      <td className="action-buttons">
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteInstructor(instructor._id, instructor.name)}
                          title="Delete instructor"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorManagement;

