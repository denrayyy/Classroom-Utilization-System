import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ClassroomManagement.css";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher";
  employeeId: string;
  department: string;
}

interface Schedule {
  day: string;
  time: string;
  section: string;
  subjectCode: string;
  instructor: string;
}

interface Classroom {
  _id: string;
  name: string;
  capacity: number;
  location: string;
  equipment: string[];
  isAvailable: boolean;
  description?: string;
  version?: number;
  schedules?: Schedule[];
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

interface ClassroomManagementProps {
  user: User;
}

const ClassroomManagement: React.FC<ClassroomManagementProps> = ({ user }) => {
  // Classroom state
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [activeTimeIns, setActiveTimeIns] = useState<any[]>([]);
  const [showClassroomForm, setShowClassroomForm] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(
    null,
  );
  const [showScheduleView, setShowScheduleView] = useState(false);
  const [viewingClassroom, setViewingClassroom] = useState<Classroom | null>(
    null,
  );
  const [isEditingSchedules, setIsEditingSchedules] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [scheduleFormData, setScheduleFormData] = useState({
    day: "Monday",
    time: "",
    section: "",
    subjectCode: "",
    instructor: "",
  });
  const [classroomFormData, setClassroomFormData] = useState({
    name: "",
    location: "",
    description: "",
    isAvailable: true,
    capacity: "",
    equipment: "",
  });
  const [roomFilter, setRoomFilter] = useState<"all" | "comlab" | "non-comlab">(
    "all",
  );

  // Schedule editing state
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<
    number | null
  >(null);

  // Archive/Restore confirmation states
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [classroomToArchive, setClassroomToArchive] = useState<{
    id: string;
    name: string;
    version?: number;
  } | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [classroomToRestore, setClassroomToRestore] = useState<{
    id: string;
    name: string;
    version?: number;
  } | null>(null);

  // Stats
  const [totalActive, setTotalActive] = useState(0);
  const [totalArchived, setTotalArchived] = useState(0);
  const [totalComlabs, setTotalComlabs] = useState(0);
  const [totalCapacity, setTotalCapacity] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [versionConflict, setVersionConflict] = useState(false);

  useEffect(() => {
    fetchData();
  }, [showArchived]);

  useEffect(() => {
    calculateStats();
  }, [classrooms]);

  const calculateStats = () => {
    const active = classrooms.filter((c) => !c.isArchived).length;
    const archived = classrooms.filter((c) => c.isArchived).length;
    const comlabs = classrooms.filter(
      (c) => /comlab/i.test(c.name) || /comlab/i.test(c.location),
    ).length;
    const capacity = classrooms.reduce((sum, c) => sum + (c.capacity || 0), 0);

    setTotalActive(active);
    setTotalArchived(archived);
    setTotalComlabs(comlabs);
    setTotalCapacity(capacity);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please log in again.");
        setLoading(false);
        return;
      }

      if (!axios.defaults.headers.common["Authorization"]) {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }

      // Fetch classrooms with showArchived parameter
      const response = await axios.get("/api/classrooms", {
        params: {
          showArchived: showArchived ? "true" : "false",
        },
      });
      setClassrooms(response.data);

      // Fetch active time-ins (records without timeOut)
      try {
        const timeInResponse = await axios.get("/api/timein");
        const activeRecords = timeInResponse.data.filter(
          (record: any) => !record.timeOut,
        );
        setActiveTimeIns(activeRecords);
      } catch (timeInError) {
        console.warn("Could not fetch active time-ins:", timeInError);
        setActiveTimeIns([]);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        setError("Authentication failed. Please log in again.");
      } else if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error.message) {
        setError(error.message);
      } else {
        setError("Failed to fetch data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if classroom is in use
  const isClassroomInUse = (classroomId: string) => {
    return activeTimeIns.some(
      (record: any) => record.classroom && record.classroom._id === classroomId,
    );
  };

  // Classroom handlers
  const handleClassroomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVersionConflict(false);
    setSuccess("");

    try {
      const classroomData: any = {
        name: classroomFormData.name,
        location: classroomFormData.location,
        description: classroomFormData.description,
        isAvailable: classroomFormData.isAvailable,
      };

      // Add optional fields
      if (classroomFormData.capacity) {
        classroomData.capacity = parseInt(classroomFormData.capacity);
      }

      if (classroomFormData.equipment) {
        classroomData.equipment = classroomFormData.equipment
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item);
      }

      if (editingClassroom) {
        classroomData.version = editingClassroom.version;
        await axios.put(
          `/api/classrooms/${editingClassroom._id}`,
          classroomData,
        );
        setSuccess("Classroom updated successfully!");
      } else {
        await axios.post("/api/classrooms", classroomData);
        setSuccess("Classroom created successfully!");
      }

      setShowClassroomForm(false);
      setEditingClassroom(null);
      setClassroomFormData({
        name: "",
        location: "",
        description: "",
        isAvailable: true,
        capacity: "",
        equipment: "",
      });
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      const statusCode = error.response?.status;
      const responseData = error.response?.data;

      if (statusCode === 409) {
        const conflictMessage =
          responseData?.message ||
          "Another admin updated this classroom. Refresh and try again.";
        setVersionConflict(true);
        setError("⚠️ CONFLICT DETECTED:\n\n" + conflictMessage);
        return;
      }

      setError(
        error.response?.data?.message ||
          error.response?.data?.msg ||
          "Failed to save classroom",
      );
    }
  };

  const handleEditClassroom = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    setClassroomFormData({
      name: classroom.name,
      location: classroom.location,
      description: classroom.description || "",
      isAvailable: classroom.isAvailable,
      capacity: classroom.capacity?.toString() || "",
      equipment: classroom.equipment?.join(", ") || "",
    });
    setShowClassroomForm(true);
  };

  const handleArchiveClick = (classroom: Classroom) => {
    setClassroomToArchive({
      id: classroom._id,
      name: classroom.name,
      version: classroom.version,
    });
    setShowArchiveConfirm(true);
  };

  const handleArchiveConfirm = async () => {
    if (!classroomToArchive) return;
    if (classroomToArchive.version === undefined) {
      setError(
        "Unable to archive this classroom because version information is missing. Please refresh the page and try again.",
      );
      setShowArchiveConfirm(false);
      setClassroomToArchive(null);
      return;
    }

    try {
      await axios.patch(`/api/classrooms/${classroomToArchive.id}/archive`, {
        version: classroomToArchive.version,
      });
      setSuccess(
        `Classroom "${classroomToArchive.name}" archived successfully!`,
      );
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      const statusCode = error.response?.status;

      if (statusCode === 409) {
        setVersionConflict(true);
        setError(
          "⚠️ CONFLICT DETECTED: Another admin updated this classroom. Please refresh and try again.",
        );
      } else {
        setError(
          error.response?.data?.message ||
            error.response?.data?.msg ||
            "Failed to archive classroom",
        );
      }
      setTimeout(() => setError(""), 3000);
    } finally {
      setShowArchiveConfirm(false);
      setClassroomToArchive(null);
    }
  };

  const handleArchiveCancel = () => {
    setShowArchiveConfirm(false);
    setClassroomToArchive(null);
  };

  const handleRestoreClick = (classroom: Classroom) => {
    setClassroomToRestore({
      id: classroom._id,
      name: classroom.name,
      version: classroom.version,
    });
    setShowRestoreConfirm(true);
  };

  const handleRestoreConfirm = async () => {
    if (!classroomToRestore) return;
    if (classroomToRestore.version === undefined) {
      setError(
        "Unable to restore this classroom because version information is missing. Please refresh the page and try again.",
      );
      setShowRestoreConfirm(false);
      setClassroomToRestore(null);
      return;
    }

    try {
      await axios.patch(`/api/classrooms/${classroomToRestore.id}/restore`, {
        version: classroomToRestore.version,
      });
      setSuccess(
        `Classroom "${classroomToRestore.name}" restored successfully!`,
      );
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      const statusCode = error.response?.status;

      if (statusCode === 409) {
        setVersionConflict(true);
        setError(
          "⚠️ CONFLICT DETECTED: Another admin updated this classroom. Please refresh and try again.",
        );
      } else {
        setError(
          error.response?.data?.message ||
            error.response?.data?.msg ||
            "Failed to restore classroom",
        );
      }
      setTimeout(() => setError(""), 3000);
    } finally {
      setShowRestoreConfirm(false);
      setClassroomToRestore(null);
    }
  };

  const handleRestoreCancel = () => {
    setShowRestoreConfirm(false);
    setClassroomToRestore(null);
  };

  const handleCancelClassroom = () => {
    setShowClassroomForm(false);
    setEditingClassroom(null);
    setClassroomFormData({
      name: "",
      location: "",
      description: "",
      isAvailable: true,
      capacity: "",
      equipment: "",
    });
    setError("");
    setVersionConflict(false);
  };

  const handleViewSchedules = (classroom: Classroom) => {
    setViewingClassroom(classroom);
    setShowScheduleView(true);
    setEditingScheduleIndex(null);
    setScheduleFormData({
      day: "Monday",
      time: "",
      section: "",
      subjectCode: "",
      instructor: "",
    });
  };

  const handleCloseScheduleView = () => {
    setShowScheduleView(false);
    setViewingClassroom(null);
    setIsEditingSchedules(false);
    setEditingScheduleIndex(null);
    setScheduleFormData({
      day: "Monday",
      time: "",
      section: "",
      subjectCode: "",
      instructor: "",
    });
  };

  const handleSaveSchedules = async () => {
    if (!viewingClassroom) return;

    try {
      setVersionConflict(false);
      const response = await axios.put(
        `/api/classrooms/${viewingClassroom._id}`,
        {
          schedules: viewingClassroom.schedules,
          version: viewingClassroom.version,
        },
      );
      setSuccess("Schedules updated successfully!");
      setIsEditingSchedules(false);
      setEditingScheduleIndex(null);
      setViewingClassroom(response.data);
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      const statusCode = error.response?.status;
      const responseData = error.response?.data;

      if (statusCode === 409) {
        const conflictMessage =
          responseData?.message ||
          "Another admin updated this classroom. Refresh and try again.";
        setVersionConflict(true);
        setError("⚠️ CONFLICT DETECTED:\n\n" + conflictMessage);
        return;
      }

      setError(
        error.response?.data?.message ||
          error.response?.data?.msg ||
          "Failed to update schedules",
      );
    }
  };

  const handleAddSchedule = () => {
    if (!viewingClassroom) return;
    if (
      !scheduleFormData.time ||
      !scheduleFormData.section ||
      !scheduleFormData.subjectCode ||
      !scheduleFormData.instructor
    ) {
      setError("Please fill in all schedule fields");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const newSchedule = {
      day: scheduleFormData.day,
      time: scheduleFormData.time,
      section: scheduleFormData.section,
      subjectCode: scheduleFormData.subjectCode,
      instructor: scheduleFormData.instructor,
    };

    setViewingClassroom({
      ...viewingClassroom,
      schedules: [...(viewingClassroom.schedules || []), newSchedule],
    });

    setScheduleFormData({
      day: "Monday",
      time: "",
      section: "",
      subjectCode: "",
      instructor: "",
    });
    setError("");
  };

  const handleEditSchedule = (index: number) => {
    if (!viewingClassroom || !viewingClassroom.schedules) return;

    const schedule = viewingClassroom.schedules[index];
    setScheduleFormData({
      day: schedule.day,
      time: schedule.time,
      section: schedule.section,
      subjectCode: schedule.subjectCode,
      instructor: schedule.instructor,
    });
    setEditingScheduleIndex(index);
  };

  const handleUpdateSchedule = () => {
    if (!viewingClassroom || editingScheduleIndex === null) return;
    if (
      !scheduleFormData.time ||
      !scheduleFormData.section ||
      !scheduleFormData.subjectCode ||
      !scheduleFormData.instructor
    ) {
      setError("Please fill in all schedule fields");
      setTimeout(() => setError(""), 3000);
      return;
    }

    const updatedSchedules = [...(viewingClassroom.schedules || [])];
    updatedSchedules[editingScheduleIndex] = {
      day: scheduleFormData.day,
      time: scheduleFormData.time,
      section: scheduleFormData.section,
      subjectCode: scheduleFormData.subjectCode,
      instructor: scheduleFormData.instructor,
    };

    setViewingClassroom({
      ...viewingClassroom,
      schedules: updatedSchedules,
    });

    setEditingScheduleIndex(null);
    setScheduleFormData({
      day: "Monday",
      time: "",
      section: "",
      subjectCode: "",
      instructor: "",
    });
    setError("");
  };

  const handleCancelEditSchedule = () => {
    setEditingScheduleIndex(null);
    setScheduleFormData({
      day: "Monday",
      time: "",
      section: "",
      subjectCode: "",
      instructor: "",
    });
    setError("");
  };

  const handleDeleteSchedule = (index: number) => {
    if (!viewingClassroom) return;

    const updatedSchedules =
      viewingClassroom.schedules?.filter((_, i) => i !== index) || [];
    setViewingClassroom({
      ...viewingClassroom,
      schedules: updatedSchedules,
    });
  };

  const handleRefresh = () => {
    fetchData();
    handleCancelClassroom();
  };

  const getStatusBadge = (isAvailable: boolean, isArchived: boolean) => {
    if (isArchived) {
      return <span className="badge badge-archived">📦 Archived</span>;
    }
    return isAvailable ? (
      <span className="badge badge-available">✅ Available</span>
    ) : (
      <span className="badge badge-unavailable">⛔ Not Available</span>
    );
  };

  const getRoomTypeIcon = (room: Classroom) => {
    if (/comlab/i.test(room.name) || /comlab/i.test(room.location)) {
      return "🖥️";
    }
    return "🏛️";
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading classrooms...</p>
      </div>
    );
  }

  const isComlab = (room: Classroom) =>
    /comlab/i.test(room.name) || /comlab/i.test(room.location);
  const filteredClassrooms =
    roomFilter === "all"
      ? classrooms
      : roomFilter === "comlab"
        ? classrooms.filter(isComlab)
        : classrooms.filter((room) => !isComlab(room));

  return (
    <div className="classroom-management">
      <div className="page-header">
        <div className="header-content">
          <h1>Classroom Management</h1>
          <p>Manage classroom information, schedules, and availability</p>
        </div>
        <div className="header-stats">
          <div className="stat-chip">
            <span className="stat-label">Active</span>
            <span className="stat-value">{totalActive}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">ComLabs</span>
            <span className="stat-value">{totalComlabs}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Capacity</span>
            <span className="stat-value">{totalCapacity}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Archived</span>
            <span className="stat-value">{totalArchived}</span>
          </div>
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {versionConflict && (
        <div className="alert alert-warning">
          <div className="alert-content">
            <strong>⚠️ Data was updated elsewhere:</strong> The classroom data
            has been modified by another user. Please click "Refresh" to reload
            the latest data and try your changes again.
          </div>
          <button className="btn btn-secondary" onClick={handleRefresh}>
            Refresh
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>
            <span className="header-icon">{showArchived ? "📦" : "🏛️"}</span>
            {showArchived ? "Archived Classrooms" : "Active Classrooms"}
          </h2>

          <div className="header-actions">
            <div className="filter-group">
              <span className="filter-label">Room type:</span>
              <select
                value={roomFilter}
                onChange={(e) =>
                  setRoomFilter(
                    e.target.value as "all" | "comlab" | "non-comlab",
                  )
                }
                className="filter-select"
              >
                <option value="all">All Rooms</option>
                <option value="comlab">ComLab Only</option>
                <option value="non-comlab">Non-ComLab</option>
              </select>
            </div>

            <button
              className={`btn ${showArchived ? "btn-secondary" : "btn-outline"}`}
              onClick={() => setShowArchived(!showArchived)}
            >
              <span className="btn-icon">{showArchived ? "👁️" : "📦"}</span>
              {showArchived
                ? "Show Active"
                : `View Archived (${totalArchived})`}
            </button>

            {!showClassroomForm && !showArchived && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditingClassroom(null);
                  setClassroomFormData({
                    name: "",
                    location: "",
                    description: "",
                    isAvailable: true,
                    capacity: "",
                    equipment: "",
                  });
                  setShowClassroomForm(true);
                }}
              >
                <span className="btn-icon">➕</span>
                Add Classroom
              </button>
            )}
          </div>
        </div>

        {showClassroomForm && (
          <div className="form-container">
            <form onSubmit={handleClassroomSubmit} className="classroom-form">
              <h3>
                {editingClassroom ? "Edit Classroom" : "Add New Classroom"}
              </h3>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="name">Classroom Name *</label>
                  <input
                    type="text"
                    id="name"
                    value={classroomFormData.name}
                    onChange={(e) =>
                      setClassroomFormData({
                        ...classroomFormData,
                        name: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g., ComLab 1, Lecture Hall A"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location *</label>
                  <input
                    type="text"
                    id="location"
                    value={classroomFormData.location}
                    onChange={(e) =>
                      setClassroomFormData({
                        ...classroomFormData,
                        location: e.target.value,
                      })
                    }
                    required
                    placeholder="e.g., Building A, Room 101"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="capacity">Capacity</label>
                  <input
                    type="number"
                    id="capacity"
                    value={classroomFormData.capacity}
                    onChange={(e) =>
                      setClassroomFormData({
                        ...classroomFormData,
                        capacity: e.target.value,
                      })
                    }
                    placeholder="Number of seats"
                    min="1"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="equipment">Equipment</label>
                  <input
                    type="text"
                    id="equipment"
                    value={classroomFormData.equipment}
                    onChange={(e) =>
                      setClassroomFormData({
                        ...classroomFormData,
                        equipment: e.target.value,
                      })
                    }
                    placeholder="Projector, Whiteboard, etc. (comma separated)"
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={classroomFormData.description}
                    onChange={(e) =>
                      setClassroomFormData({
                        ...classroomFormData,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                    placeholder="Additional details about the classroom..."
                  />
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={classroomFormData.isAvailable}
                      onChange={(e) =>
                        setClassroomFormData({
                          ...classroomFormData,
                          isAvailable: e.target.checked,
                        })
                      }
                    />
                    <span className="checkbox-text">Available for booking</span>
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelClassroom}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingClassroom ? "Update Classroom" : "Create Classroom"}
                </button>
              </div>
            </form>
          </div>
        )}

        {!showClassroomForm && (
          <div className="classroom-grid">
            {filteredClassrooms.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  {showArchived ? "📦" : "🏛️"}
                </div>
                <h3>No Classrooms Found</h3>
                <p>
                  {showArchived
                    ? "No archived classrooms available."
                    : roomFilter === "all"
                      ? "Get started by adding your first classroom."
                      : roomFilter === "comlab"
                        ? "No ComLab classrooms found."
                        : "No non-ComLab classrooms found."}
                </p>
                {!showArchived && roomFilter === "all" && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setEditingClassroom(null);
                      setClassroomFormData({
                        name: "",
                        location: "",
                        description: "",
                        isAvailable: true,
                        capacity: "",
                        equipment: "",
                      });
                      setShowClassroomForm(true);
                    }}
                  >
                    Add Classroom
                  </button>
                )}
              </div>
            ) : (
              <div className="classroom-cards">
                {filteredClassrooms.map((classroom) => {
                  const inUse = isClassroomInUse(classroom._id);
                  return (
                    <div
                      key={classroom._id}
                      className={`classroom-card ${classroom.isArchived ? "archived" : ""} ${inUse ? "in-use" : ""}`}
                    >
                      <div className="card-header">
                        <div className="room-icon">
                          {getRoomTypeIcon(classroom)}
                        </div>
                        <div className="room-info">
                          <h3>{classroom.name}</h3>
                          <div className="room-meta">
                            <span className="room-location">
                              📍 {classroom.location}
                            </span>
                            {classroom.capacity > 0 && (
                              <span className="room-capacity">
                                👥 {classroom.capacity} seats
                              </span>
                            )}
                          </div>
                        </div>
                        {inUse && (
                          <span
                            className="in-use-badge"
                            title="Currently in use"
                          >
                            ⏳ In Use
                          </span>
                        )}
                      </div>

                      <div className="card-body">
                        {classroom.description && (
                          <div className="room-description">
                            {classroom.description}
                          </div>
                        )}

                        {classroom.equipment &&
                          classroom.equipment.length > 0 && (
                            <div className="room-equipment">
                              <span className="equipment-label">
                                Equipment:
                              </span>
                              <div className="equipment-tags">
                                {classroom.equipment.map((item, index) => (
                                  <span key={index} className="equipment-tag">
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                        <div className="room-status">
                          {getStatusBadge(
                            classroom.isAvailable,
                            classroom.isArchived,
                          )}
                        </div>
                      </div>

                      <div className="card-footer">
                        <div className="action-buttons">
                          <button
                            className="btn-icon-label primary"
                            onClick={() => handleViewSchedules(classroom)}
                            title="View schedules"
                          >
                            <span className="btn-icon">📅</span>
                            Schedule
                          </button>

                          {showArchived ? (
                            <button
                              className="btn-icon-label success"
                              onClick={() => handleRestoreClick(classroom)}
                              title="Restore classroom"
                            >
                              <span className="btn-icon">♻️</span>
                              Restore
                            </button>
                          ) : (
                            <>
                              <button
                                className="btn-icon-label"
                                onClick={() => handleEditClassroom(classroom)}
                                title="Edit classroom"
                              >
                                <span className="btn-icon">✏️</span>
                                Edit
                              </button>
                              <button
                                className="btn-icon-label warning"
                                onClick={() => handleArchiveClick(classroom)}
                                disabled={inUse}
                                title={
                                  inUse
                                    ? "Cannot archive classroom while in use"
                                    : "Archive classroom"
                                }
                              >
                                <span className="btn-icon">📦</span>
                                Archive
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule View Modal */}
      {showScheduleView && viewingClassroom && (
        <div className="modal-overlay">
          <div className="modal-content schedule-modal">
            <div className="modal-header">
              <h3>
                <span className="modal-icon">📅</span>
                {viewingClassroom.name} - Schedule
              </h3>
              <button className="modal-close" onClick={handleCloseScheduleView}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {success && <div className="alert alert-success">{success}</div>}
              {error && <div className="alert alert-error">{error}</div>}

              <div className="schedule-actions">
                {!isEditingSchedules ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => setIsEditingSchedules(true)}
                  >
                    <span className="btn-icon">✏️</span>
                    Edit Schedules
                  </button>
                ) : (
                  <button
                    className="btn btn-success"
                    onClick={handleSaveSchedules}
                  >
                    <span className="btn-icon">💾</span>
                    Save Changes
                  </button>
                )}
              </div>

              {isEditingSchedules && (
                <div className="schedule-form">
                  <h4>
                    {editingScheduleIndex !== null
                      ? "Edit Schedule"
                      : "Add New Schedule"}
                  </h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Day</label>
                      <select
                        value={scheduleFormData.day}
                        onChange={(e) =>
                          setScheduleFormData({
                            ...scheduleFormData,
                            day: e.target.value,
                          })
                        }
                      >
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Time</label>
                      <input
                        type="text"
                        value={scheduleFormData.time}
                        onChange={(e) =>
                          setScheduleFormData({
                            ...scheduleFormData,
                            time: e.target.value,
                          })
                        }
                        placeholder="e.g., 7:30-9:00"
                      />
                    </div>
                    <div className="form-group">
                      <label>Section</label>
                      <input
                        type="text"
                        value={scheduleFormData.section}
                        onChange={(e) =>
                          setScheduleFormData({
                            ...scheduleFormData,
                            section: e.target.value,
                          })
                        }
                        placeholder="e.g., BSIT 3F"
                      />
                    </div>
                    <div className="form-group">
                      <label>Subject Code</label>
                      <input
                        type="text"
                        value={scheduleFormData.subjectCode}
                        onChange={(e) =>
                          setScheduleFormData({
                            ...scheduleFormData,
                            subjectCode: e.target.value,
                          })
                        }
                        placeholder="e.g., IT 137"
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Instructor</label>
                      <input
                        type="text"
                        value={scheduleFormData.instructor}
                        onChange={(e) =>
                          setScheduleFormData({
                            ...scheduleFormData,
                            instructor: e.target.value,
                          })
                        }
                        placeholder="e.g., CASERES"
                      />
                    </div>
                  </div>
                  <div className="form-actions">
                    {editingScheduleIndex !== null ? (
                      <>
                        <button
                          className="btn btn-primary"
                          onClick={handleUpdateSchedule}
                        >
                          Update Schedule
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={handleCancelEditSchedule}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-outline"
                        onClick={handleAddSchedule}
                      >
                        <span className="btn-icon">➕</span>
                        Add Schedule
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="schedule-table-container">
                {viewingClassroom.schedules &&
                viewingClassroom.schedules.length > 0 ? (
                  <table className="schedule-table">
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Time</th>
                        <th>Section</th>
                        <th>Subject Code</th>
                        <th>Instructor</th>
                        {isEditingSchedules && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {viewingClassroom.schedules.map((schedule, index) => (
                        <tr key={index}>
                          <td>
                            <span className="schedule-day">{schedule.day}</span>
                          </td>
                          <td>{schedule.time}</td>
                          <td>
                            <span className="schedule-section">
                              {schedule.section}
                            </span>
                          </td>
                          <td>
                            <span className="schedule-subject">
                              {schedule.subjectCode}
                            </span>
                          </td>
                          <td>{schedule.instructor}</td>
                          {isEditingSchedules && (
                            <td className="action-cell">
                              <button
                                className="btn-icon-only primary"
                                onClick={() => handleEditSchedule(index)}
                                title="Edit schedule"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn-icon-only danger"
                                onClick={() => handleDeleteSchedule(index)}
                                title="Delete schedule"
                              >
                                🗑️
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state small">
                    <div className="empty-state-icon">📅</div>
                    <p>No schedules assigned to this classroom.</p>
                    {isEditingSchedules && (
                      <button
                        className="btn btn-outline"
                        onClick={() => {
                          setScheduleFormData({
                            day: "Monday",
                            time: "",
                            section: "",
                            subjectCode: "",
                            instructor: "",
                          });
                        }}
                      >
                        Add First Schedule
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              {isEditingSchedules && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsEditingSchedules(false);
                    setEditingScheduleIndex(null);
                    setScheduleFormData({
                      day: "Monday",
                      time: "",
                      section: "",
                      subjectCode: "",
                      instructor: "",
                    });
                  }}
                >
                  Cancel Edit
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleCloseScheduleView}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && classroomToArchive && (
        <div className="modal-overlay">
          <div className="modal-content confirm-modal">
            <div className="modal-header">
              <h3>
                <span className="modal-icon">📦</span>
                Archive Classroom
              </h3>
              <button className="modal-close" onClick={handleArchiveCancel}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                Are you sure you want to archive{" "}
                <strong>{classroomToArchive.name}</strong>?
              </p>
              <p className="warning-text">
                This classroom will be moved to the archived list and won't
                appear in active classroom listings. You can restore it anytime.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleArchiveCancel}
              >
                Cancel
              </button>
              <button
                className="btn btn-warning"
                onClick={handleArchiveConfirm}
              >
                Yes, Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && classroomToRestore && (
        <div className="modal-overlay">
          <div className="modal-content confirm-modal">
            <div className="modal-header">
              <h3>
                <span className="modal-icon">♻️</span>
                Restore Classroom
              </h3>
              <button className="modal-close" onClick={handleRestoreCancel}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                Are you sure you want to restore{" "}
                <strong>{classroomToRestore.name}</strong>?
              </p>
              <p className="info-text">
                This classroom will be moved back to the active classroom list.
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={handleRestoreCancel}
              >
                Cancel
              </button>
              <button
                className="btn btn-success"
                onClick={handleRestoreConfirm}
              >
                Yes, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassroomManagement;
