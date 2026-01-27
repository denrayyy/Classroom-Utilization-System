import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ScheduleManagement.css";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher"; // 'teacher' kept for backward compatibility
  employeeId: string;
  department: string;
}

interface Classroom {
  _id: string;
  name: string;
  location: string;
  capacity: number;
}

interface Schedule {
  _id: string;
  student: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    employeeId: string;
    department: string;
  };
  classroom: Classroom;
  subject: string;
  courseCode: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: string;
  academicYear: string;
  status: "pending" | "approved" | "rejected" | "active" | "completed";
  requestDate: string;
  approvedBy?: {
    firstName: string;
    lastName: string;
  };
  approvedDate?: string;
  notes?: string;
}

interface ScheduleManagementProps {
  user: User;
}

const ScheduleManagement: React.FC<ScheduleManagementProps> = ({ user }) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [excludeComLabs, setExcludeComLabs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    classroom: "",
    subject: "",
    courseCode: "",
    dayOfWeek: "",
    startTime: "",
    endTime: "",
    semester: "",
    academicYear: "",
    notes: "",
    isRecurring: true,
    endDate: "",
  });
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchClassrooms();
  }, [excludeComLabs]);

  const fetchClassrooms = async () => {
    try {
      const params = excludeComLabs ? { excludeComputerLabs: true } : {};
      const classroomsRes = await axios.get("/api/classrooms", { params });
      setClassrooms(classroomsRes.data);
    } catch (error) {
      console.error("Error fetching classrooms:", error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schedulesRes] = await Promise.all([axios.get("/api/schedules")]);
      setSchedules(schedulesRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const scheduleData = {
        ...formData,
        endDate: formData.endDate || undefined,
      };

      if (editingSchedule) {
        const payload = {
          ...scheduleData,
          version: (editingSchedule as any).version,
        };
        await axios.put(`/api/schedules/${editingSchedule._id}`, payload);
      } else {
        await axios.post("/api/schedules", scheduleData);
      }

      setShowForm(false);
      setEditingSchedule(null);
      setFormData({
        classroom: "",
        subject: "",
        courseCode: "",
        dayOfWeek: "",
        startTime: "",
        endTime: "",
        semester: "",
        academicYear: "",
        notes: "",
        isRecurring: true,
        endDate: "",
      });
      fetchData();
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to save schedule");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await axios.put(`/api/schedules/${id}/approve`);
      fetchData();
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to approve schedule");
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Please provide a reason for rejection:");
    if (reason) {
      try {
        await axios.put(`/api/schedules/${id}/reject`, { notes: reason });
        fetchData();
      } catch (error: any) {
        setError(error.response?.data?.message || "Failed to reject schedule");
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this schedule?")) {
      try {
        await axios.delete(`/api/schedules/${id}`);
        fetchData();
      } catch (error: any) {
        setError(error.response?.data?.message || "Failed to delete schedule");
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingSchedule(null);
    setFormData({
      classroom: "",
      subject: "",
      courseCode: "",
      dayOfWeek: "",
      startTime: "",
      endTime: "",
      semester: "",
      academicYear: "",
      notes: "",
      isRecurring: true,
      endDate: "",
    });
    setError("");
  };

  const handleEditClick = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      classroom: schedule.classroom?._id || "",
      subject: schedule.subject,
      courseCode: schedule.courseCode || "",
      dayOfWeek: schedule.dayOfWeek || "",
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      semester: schedule.semester || "",
      academicYear: schedule.academicYear || "",
      notes: schedule.notes || "",
      isRecurring: true,
      endDate: "",
    });
    setShowForm(true);
  };

  const filteredSchedules = schedules.filter((schedule) => {
    if (filter === "all") return true;
    if (filter === "my") return schedule.student._id === user.id;
    return schedule.status === filter;
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading schedules...</p>
      </div>
    );
  }

  return (
    <div className="schedule-management">
      <div className="page-header"></div>

      {error && <div className="error-message">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h2>Schedules</h2>
          <div className="header-actions">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Schedules</option>
              <option value="my">My Schedules</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={excludeComLabs}
                onChange={(e) => setExcludeComLabs(e.target.checked)}
              />
              Exclude ComLab rooms
            </label>
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              Request Schedule
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="schedule-form">
            <h3>
              {editingSchedule ? "Edit Schedule" : "Request New Schedule"}
            </h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="classroom">Classroom</label>
                <select
                  id="classroom"
                  value={formData.classroom}
                  onChange={(e) =>
                    setFormData({ ...formData, classroom: e.target.value })
                  }
                  required
                >
                  <option value="">Select a classroom</option>
                  {classrooms.map((classroom) => (
                    <option key={classroom._id} value={classroom._id}>
                      {classroom.name} - {classroom.location}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="dayOfWeek">Day of Week</label>
                <select
                  id="dayOfWeek"
                  value={formData.dayOfWeek}
                  onChange={(e) =>
                    setFormData({ ...formData, dayOfWeek: e.target.value })
                  }
                  required
                >
                  <option value="">Select day</option>
                  <option value="Monday">Monday</option>
                  <option value="Tuesday">Tuesday</option>
                  <option value="Wednesday">Wednesday</option>
                  <option value="Thursday">Thursday</option>
                  <option value="Friday">Friday</option>
                  <option value="Saturday">Saturday</option>
                  <option value="Sunday">Sunday</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input
                  type="text"
                  id="subject"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="courseCode">Course Code</label>
                <input
                  type="text"
                  id="courseCode"
                  value={formData.courseCode}
                  onChange={(e) =>
                    setFormData({ ...formData, courseCode: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="startTime">Start Time</label>
                <input
                  type="time"
                  id="startTime"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="endTime">End Time</label>
                <input
                  type="time"
                  id="endTime"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="semester">Semester</label>
                <input
                  type="text"
                  id="semester"
                  value={formData.semester}
                  onChange={(e) =>
                    setFormData({ ...formData, semester: e.target.value })
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="academicYear">Academic Year</label>
                <input
                  type="text"
                  id="academicYear"
                  value={formData.academicYear}
                  onChange={(e) =>
                    setFormData({ ...formData, academicYear: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingSchedule ? "Update" : "Submit"} Request
              </button>
            </div>
          </form>
        )}

        <div className="schedules-list">
          {filteredSchedules.length === 0 ? (
            <div className="no-schedules">
              <p>No schedules found.</p>
            </div>
          ) : (
            filteredSchedules.map((schedule) => (
              <div key={schedule._id} className="schedule-card">
                <div className="schedule-header">
                  <div className="schedule-title">
                    <h3>
                      {schedule.subject} - {schedule.courseCode}
                    </h3>
                    <span className={`status-badge status-${schedule.status}`}>
                      {schedule.status}
                    </span>
                  </div>
                  <div className="schedule-actions">
                    {user.role === "admin" && schedule.status === "pending" && (
                      <>
                        <button
                          className="btn btn-success"
                          onClick={() => handleApprove(schedule._id)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleReject(schedule._id)}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {(schedule.student._id === user.id ||
                      user.role === "admin") && (
                      <button
                        className="btn btn-outline"
                        onClick={() => handleEditClick(schedule)}
                      >
                        Edit
                      </button>
                    )}
                    {(schedule.student._id === user.id ||
                      user.role === "admin") && (
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(schedule._id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="schedule-details">
                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-label">Classroom:</span>
                      <span className="detail-value">
                        {schedule.classroom.name} -{" "}
                        {schedule.classroom.location}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Day:</span>
                      <span className="detail-value">{schedule.dayOfWeek}</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-label">Time:</span>
                      <span className="detail-value">
                        {schedule.startTime} - {schedule.endTime}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Student:</span>
                      <span className="detail-value">
                        {schedule.student.firstName} {schedule.student.lastName}
                      </span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="detail-label">Semester:</span>
                      <span className="detail-value">
                        {schedule.semester} {schedule.academicYear}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Requested:</span>
                      <span className="detail-value">
                        {new Date(schedule.requestDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {schedule.notes && (
                    <div className="detail-item">
                      <span className="detail-label">Notes:</span>
                      <span className="detail-value">{schedule.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleManagement;
