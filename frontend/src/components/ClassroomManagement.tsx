import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ClassroomManagement.css";
import {
  Plus,
  Archive,
  Eye,
  Pencil,
  RotateCcw,
  Calendar,
  Save,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Monitor,
  Building,
  MapPin,
  Users,
  Clock,
  X,
  Trash2,
  Hourglass,
  FileText,
} from "lucide-react";
import PDFUploader from "./PDFUploader";

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
  const [showPDFUploader, setShowPDFUploader] = useState(false);
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

  // In Use Warning state
  const [showInUseWarning, setShowInUseWarning] = useState(false);
  const [inUseClassroom, setInUseClassroom] = useState<{
    name: string;
    instructorName?: string;
    timeIn?: string;
  } | null>(null);

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

  // ============ SCHEDULE CONFLICT DETECTION FUNCTIONS ============
  const hasScheduleConflict = (schedules: Schedule[] = []): boolean => {
    const seen = new Set<string>();
    for (const schedule of schedules) {
      const key = `${schedule.day}|${schedule.time}|${schedule.section}|${schedule.subjectCode}|${schedule.instructor}`;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  };

  const getConflictingSchedules = (schedules: Schedule[] = []): Schedule[] => {
    const seen = new Map<string, number>();
    const conflicts: Schedule[] = [];
    schedules.forEach((schedule) => {
      const key = `${schedule.day}|${schedule.time}|${schedule.section}|${schedule.subjectCode}|${schedule.instructor}`;
      if (seen.has(key)) conflicts.push(schedule);
      else seen.set(key, 1);
    });
    return conflicts;
  };

  const isScheduleDuplicate = (schedule: Schedule, index?: number): boolean => {
    if (!viewingClassroom?.schedules) return false;
    return viewingClassroom.schedules.some((s, i) => {
      if (index !== undefined && i === index) return false;
      return (
        s.day === schedule.day &&
        s.time === schedule.time &&
        s.section === schedule.section &&
        s.subjectCode === schedule.subjectCode &&
        s.instructor === schedule.instructor
      );
    });
  };
  // ============ END SCHEDULE CONFLICT FUNCTIONS ============

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
      const response = await axios.get("/api/classrooms", {
        params: { showArchived: showArchived ? "true" : "false" },
      });
      setClassrooms(response.data);
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

  const isClassroomInUse = (classroomId: string) => {
    const now = new Date();
    const twoPointFiveHoursAgo = new Date(now.getTime() - 2.5 * 60 * 60 * 1000);
    return activeTimeIns.some((record: any) => {
      if (!record.classroom || record.classroom._id !== classroomId)
        return false;
      const timeIn = new Date(record.timeIn);
      const hasNoTimeOut = !record.timeOut;
      const isWithinLast2_5Hours = timeIn > twoPointFiveHoursAgo;
      return hasNoTimeOut && isWithinLast2_5Hours;
    });
  };

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
    const inUse = isClassroomInUse(classroom._id);
    if (inUse) {
      const activeRecord = activeTimeIns.find(
        (record: any) =>
          record.classroom && record.classroom._id === classroom._id,
      );
      setInUseClassroom({
        name: classroom.name,
        instructorName: activeRecord?.instructorName || "An instructor",
        timeIn: activeRecord?.timeIn
          ? new Date(activeRecord.timeIn).toLocaleTimeString()
          : undefined,
      });
      setShowInUseWarning(true);
    } else {
      setClassroomToArchive({
        id: classroom._id,
        name: classroom.name,
        version: classroom.version,
      });
      setShowArchiveConfirm(true);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!classroomToArchive) return;
    try {
      await axios.patch(`/api/classrooms/${classroomToArchive.id}/archive`, {
        version: classroomToArchive.version,
      });
      setSuccess(
        `Classroom "${classroomToArchive.name}" archived successfully!`,
      );
      fetchData();
    } catch (error: any) {
      if (error.response?.status === 409) {
        try {
          const response = await axios.get(
            `/api/classrooms/${classroomToArchive.id}`,
          );
          const latestVersion = response.data.version;
          await axios.patch(
            `/api/classrooms/${classroomToArchive.id}/archive`,
            {
              version: latestVersion,
            },
          );
          setSuccess(
            `Classroom "${classroomToArchive.name}" archived successfully!`,
          );
          fetchData();
        } catch (retryError) {
          setError("Failed to archive. Please refresh and try again.");
        }
      } else {
        setError(error.response?.data?.message || "Failed to archive");
      }
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
    if (hasScheduleConflict(viewingClassroom.schedules)) {
      const conflicts = getConflictingSchedules(viewingClassroom.schedules);
      setError(
        `⚠️ Cannot save: Found ${conflicts.length} duplicate schedule(s). Please remove or edit duplicates before saving.`,
      );
      setTimeout(() => setError(""), 4000);
      return;
    }
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
    const existingSchedules = viewingClassroom.schedules || [];
    const isDuplicate = existingSchedules.some(
      (schedule) =>
        schedule.day === newSchedule.day &&
        schedule.time === newSchedule.time &&
        schedule.section === newSchedule.section &&
        schedule.subjectCode === newSchedule.subjectCode &&
        schedule.instructor === newSchedule.instructor,
    );
    if (isDuplicate) {
      setError(
        "⚠️ Cannot add duplicate schedule. This schedule already exists.",
      );
      setTimeout(() => setError(""), 3000);
      return;
    }
    setViewingClassroom({
      ...viewingClassroom,
      schedules: [...existingSchedules, newSchedule],
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
    const updatedSchedule = {
      day: scheduleFormData.day,
      time: scheduleFormData.time,
      section: scheduleFormData.section,
      subjectCode: scheduleFormData.subjectCode,
      instructor: scheduleFormData.instructor,
    };
    const existingSchedules = viewingClassroom.schedules || [];
    const isDuplicate = existingSchedules.some(
      (schedule, index) =>
        index !== editingScheduleIndex &&
        schedule.day === updatedSchedule.day &&
        schedule.time === updatedSchedule.time &&
        schedule.section === updatedSchedule.section &&
        schedule.subjectCode === updatedSchedule.subjectCode &&
        schedule.instructor === updatedSchedule.instructor,
    );
    if (isDuplicate) {
      setError(
        "⚠️ Cannot update to a duplicate schedule. This schedule already exists.",
      );
      setTimeout(() => setError(""), 3000);
      return;
    }
    const updatedSchedules = [...existingSchedules];
    updatedSchedules[editingScheduleIndex] = updatedSchedule;
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
      return (
        <span className="badge badge-archived">
          <Archive size={12} color="#5C7378" />
          Archived
        </span>
      );
    }
    return isAvailable ? (
      <span className="badge badge-available">Available</span>
    ) : (
      <span className="badge badge-unavailable">Not Available</span>
    );
  };

  const getRoomTypeIcon = (room: Classroom) => {
    if (/comlab/i.test(room.name) || /comlab/i.test(room.location)) {
      return <Monitor size={24} className="icon-accent" />;
    }
    return <Building size={24} className="icon-accent" />;
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
            <span className="stat-label">Student Capacity</span>
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
            <strong>
              <AlertTriangle size={16} style={{ marginRight: "8px" }} />
              Data was updated elsewhere:
            </strong>{" "}
            The classroom data has been modified by another user. Please click
            "Refresh" to reload the latest data and try your changes again.
          </div>
          <button className="btn btn-secondary" onClick={handleRefresh}>
            Refresh
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>
            <span className="header-icon">
              {showClassroomForm ? (
                editingClassroom ? (
                  <Pencil size={20} color="#2E3944" />
                ) : (
                  <Plus size={20} color="#2E3944" />
                )
              ) : showArchived ? (
                <Archive size={20} color="#2E3944" />
              ) : (
                <Building size={20} color="#2E3944" />
              )}
            </span>
            {showClassroomForm
              ? editingClassroom
                ? "Edit Classroom"
                : "Add New Classroom"
              : showArchived
                ? "Archived Classrooms"
                : "Active Classrooms"}
          </h2>

          {!showClassroomForm && (
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

              {/* REMOVED: Import PDF Schedule button from header */}

              <button
                className={`btn ${showArchived ? "btn-secondary" : "btn-outline"}`}
                onClick={() => setShowArchived(!showArchived)}
              >
                <span className="btn-icon">
                  {showArchived ? (
                    <Eye size={16} className="icon-accent" />
                  ) : (
                    <Archive size={16} className="icon-muted" />
                  )}
                </span>
                {showArchived
                  ? "Show Active"
                  : `View Archived (${totalArchived})`}
              </button>

              {!showArchived && (
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
                  <Plus size={16} className="icon-light" />
                  Add Classroom
                </button>
              )}
            </div>
          )}
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
                  <label htmlFor="capacity">Student Capacity</label>
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
                  <div className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      id="isAvailable"
                      checked={classroomFormData.isAvailable}
                      onChange={(e) =>
                        setClassroomFormData({
                          ...classroomFormData,
                          isAvailable: e.target.checked,
                        })
                      }
                    />
                    <label
                      htmlFor="isAvailable"
                      className="checkbox-label-text"
                    >
                      Available for booking
                    </label>
                  </div>
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
                  {showArchived ? (
                    <Archive size={48} className="icon-subtle" />
                  ) : (
                    <Building size={48} className="icon-subtle" />
                  )}
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
                              <MapPin
                                size={12}
                                style={{ marginRight: "4px" }}
                              />
                              {classroom.location}
                            </span>
                            {classroom.capacity > 0 && (
                              <span className="room-capacity">
                                <Users
                                  size={12}
                                  style={{ marginRight: "4px" }}
                                />
                                {classroom.capacity} seats
                              </span>
                            )}
                          </div>
                        </div>
                        {inUse && (
                          <span
                            className="in-use-badge"
                            title="Currently in use"
                          >
                            <Clock size={12} style={{ marginRight: "4px" }} />
                            In Use
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
                            <Calendar size={14} className="icon-accent" />
                            Schedule
                          </button>

                          {showArchived ? (
                            <button
                              className="btn-icon-label success"
                              onClick={() => handleRestoreClick(classroom)}
                              title="Restore classroom"
                            >
                              <RotateCcw size={14} color="#27ae60" />
                              Restore
                            </button>
                          ) : (
                            <>
                              <button
                                className="btn-icon-label"
                                onClick={() => handleEditClassroom(classroom)}
                                title="Edit classroom"
                              >
                                <Pencil size={14} className="icon-accent" />
                                Edit
                              </button>
                              <button
                                className="btn-icon-label warning"
                                onClick={() => handleArchiveClick(classroom)}
                                title={
                                  inUse
                                    ? "Classroom is currently in use"
                                    : "Archive classroom"
                                }
                              >
                                <Archive size={14} className="icon-muted" />
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

      {/* PDF Uploader Modal */}
      {showPDFUploader && (
        <div
          className="modal-overlay"
          onClick={() => setShowPDFUploader(false)}
        >
          <div
            className="modal-content pdf-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <PDFUploader
              onClose={() => {
                setShowPDFUploader(false);
                if (viewingClassroom) {
                  setShowScheduleView(true);
                }
              }}
              onImportComplete={() => {
                fetchData();
                if (viewingClassroom) {
                  const fetchUpdatedClassroom = async () => {
                    try {
                      const token = localStorage.getItem("token");
                      const response = await axios.get(
                        `/api/classrooms/${viewingClassroom._id}`,
                        {
                          headers: { Authorization: `Bearer ${token}` },
                        },
                      );
                      setViewingClassroom(response.data);
                      setShowScheduleView(true);
                    } catch (err) {
                      console.error("Failed to refresh classroom:", err);
                    }
                  };
                  fetchUpdatedClassroom();
                }
                setSuccess(
                  `PDF schedules imported to ${viewingClassroom?.name || "classroom"}!`,
                );
                setTimeout(() => setSuccess(""), 3000);
              }}
              targetClassroom={viewingClassroom}
            />
          </div>
        </div>
      )}

      {/* Schedule View Modal */}
      {showScheduleView && viewingClassroom && (
        <div className="modal-overlay">
          <div className="modal-content schedule-modal">
            <div className="modal-header">
              <h3>
                <Calendar
                  size={20}
                  className="icon-accent"
                  style={{ marginRight: "8px" }}
                />
                {viewingClassroom.name} - Schedule
              </h3>
              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                {/* ADDED: Import PDF button in schedule modal header */}
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setShowScheduleView(false);
                    setShowPDFUploader(true);
                  }}
                  title={`Import PDF for ${viewingClassroom.name}`}
                >
                  <FileText size={16} />
                  Import PDF
                </button>
                <button
                  className="modal-close"
                  onClick={handleCloseScheduleView}
                >
                  <X size={20} color="#dc3545" />
                </button>
              </div>
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
                    <Pencil size={16} />
                    Edit Schedules
                  </button>
                ) : (
                  <button
                    className="btn btn-success"
                    onClick={handleSaveSchedules}
                  >
                    <Save size={16} />
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
                        <Plus size={16} />
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
                      {viewingClassroom.schedules.map((schedule, index) => {
                        const isDuplicate = isScheduleDuplicate(
                          schedule,
                          index,
                        );
                        return (
                          <tr
                            key={index}
                            className={isDuplicate ? "conflict-row" : ""}
                          >
                            <td>
                              <span className="schedule-day">
                                {schedule.day}
                              </span>
                              {isDuplicate && (
                                <span className="conflict-badge">
                                  <AlertTriangle
                                    size={10}
                                    style={{ marginRight: "4px" }}
                                  />
                                  Duplicate
                                </span>
                              )}
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
                                  <Pencil size={14} />
                                </button>
                                <button
                                  className="btn-icon-only danger"
                                  onClick={() => handleDeleteSchedule(index)}
                                  title="Delete schedule"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state small">
                    <div className="empty-state-icon">
                      <Calendar size={48} className="icon-subtle" />
                    </div>
                    <p>No schedules assigned to this classroom.</p>
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        justifyContent: "center",
                        marginTop: "16px",
                      }}
                    >
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
                          <Plus size={16} />
                          Add First Schedule
                        </button>
                      )}
                      {/* ADDED: Import PDF button in empty state */}
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setShowScheduleView(false);
                          setShowPDFUploader(true);
                        }}
                      >
                        <FileText size={16} />
                        Import PDF for {viewingClassroom?.name}
                      </button>
                    </div>
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
                <Archive
                  size={20}
                  className="icon-muted"
                  style={{ marginRight: "8px" }}
                />
                Archive Classroom
              </h3>
              <button className="modal-close" onClick={handleArchiveCancel}>
                <X size={20} color="#dc3545" />
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
                <RotateCcw
                  size={20}
                  color="#27ae60"
                  style={{ marginRight: "8px" }}
                />
                Restore Classroom
              </h3>
              <button className="modal-close" onClick={handleRestoreCancel}>
                <X size={20} color="#dc3545" />
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

      {/* In Use Warning Modal */}
      {showInUseWarning && inUseClassroom && (
        <div className="modal-overlay">
          <div className="modal-content confirm-modal">
            <div className="modal-header">
              <h3>
                <Hourglass
                  size={20}
                  color="#ffc107"
                  style={{ marginRight: "8px" }}
                />
                Classroom In Use
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowInUseWarning(false);
                  setInUseClassroom(null);
                }}
              >
                <X size={20} color="#dc3545" />
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                <strong>{inUseClassroom.name}</strong> is currently in use.
              </p>

              <div className="in-use-details">
                <p>
                  <Users size={16} style={{ marginRight: "8px" }} />
                  <strong>Instructor:</strong> {inUseClassroom.instructorName}
                </p>
                {inUseClassroom.timeIn && (
                  <p>
                    <Clock size={16} style={{ marginRight: "8px" }} />
                    <strong>Since:</strong> {inUseClassroom.timeIn}
                  </p>
                )}
              </div>

              <p className="warning-text">
                <AlertTriangle size={14} style={{ marginRight: "8px" }} />
                You can only archive this classroom after the current session
                ends (automatically after 2.5 hours or when the instructor times
                out).
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowInUseWarning(false);
                  setInUseClassroom(null);
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassroomManagement;
