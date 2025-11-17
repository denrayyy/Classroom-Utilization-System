import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ClassroomManagement.css';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'student' | 'admin' | 'teacher'; // 'teacher' kept for backward compatibility
  employeeId: string;
  department: string;
}

interface Classroom {
  _id: string;
  name: string;
  capacity: number;
  location: string;
  equipment: string[];
  isAvailable: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

interface ClassroomManagementProps {
  user: User;
}

const ClassroomManagement: React.FC<ClassroomManagementProps> = ({ user }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    isAvailable: true
  });
  const [error, setError] = useState('');
  const [mvccWarning, setMvccWarning] = useState(false);
  const [mvccWarningMessage, setMvccWarningMessage] = useState('This data changed while you were editing.');

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/classrooms');
      setClassrooms(response.data);
    } catch (error) {
      console.error('Error fetching classrooms:', error);
      setError('Failed to fetch classrooms');
    } finally {
      setLoading(false);
    }
  };

  const handleMvccConflict = (message?: string) => {
    setMvccWarningMessage(message || 'This data changed while you were editing.');
    setMvccWarning(true);
    fetchClassrooms();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const classroomData = {
        ...formData
      };

      if (editingClassroom) {
        await axios.put(`/api/classrooms/${editingClassroom._id}`, {
          ...classroomData,
          version: editingClassroom.version
        });
      } else {
        await axios.post('/api/classrooms', classroomData);
      }

      setShowForm(false);
      setEditingClassroom(null);
      setFormData({
        name: '',
        location: '',
        description: '',
        isAvailable: true
      });
      fetchClassrooms();
    } catch (error: any) {
      if (error.response?.status === 409) {
        handleMvccConflict(error.response?.data?.msg);
      } else {
        setError(error.response?.data?.message || error.response?.data?.msg || 'Failed to save classroom');
      }
    }
  };

  const handleEdit = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    setFormData({
      name: classroom.name,
      location: classroom.location,
      description: classroom.description || '',
      isAvailable: classroom.isAvailable
    });
    setShowForm(true);
  };

  const handleDelete = async (classroom: Classroom) => {
    if (window.confirm('Are you sure you want to delete this classroom?')) {
      try {
        await axios.delete(`/api/classrooms/${classroom._id}`, {
          data: { version: classroom.version }
        });
        fetchClassrooms();
      } catch (error: any) {
        if (error.response?.status === 409) {
          handleMvccConflict(error.response?.data?.msg);
        } else {
          setError(error.response?.data?.message || error.response?.data?.msg || 'Failed to delete classroom');
        }
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingClassroom(null);
    setFormData({
      name: '',
      location: '',
      description: '',
      isAvailable: true
    });
    setError('');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading classrooms...</p>
      </div>
    );
  }

  return (
    <div className="classroom-management">
      <div className="page-header">
        <h1>Classroom Management</h1>
        <p>Manage classroom information and availability</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h2>Classrooms</h2>
          {!showForm && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingClassroom(null);
                setFormData({
                  name: '',
                  location: '',
                  description: '',
                  isAvailable: true
                });
                setShowForm(true);
              }}
            >
              Add Classroom
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="classroom-form">
            <h3>{editingClassroom ? 'Edit Classroom' : 'Add New Classroom'}</h3>
            
            <div className="form-group">
              <label htmlFor="name">Classroom Name</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({...formData, isAvailable: e.target.checked})}
                />
                Available for booking
              </label>
            </div>

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingClassroom ? 'Update' : 'Create'} Classroom
              </button>
            </div>
          </form>
        )}
      </div>
      {mvccWarning && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h3>Data Updated</h3>
            <p>{mvccWarningMessage || 'This data changed while you were editing.'}</p>
            <div className="modal-buttons">
              <button className="btn-confirm" onClick={() => setMvccWarning(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassroomManagement;
