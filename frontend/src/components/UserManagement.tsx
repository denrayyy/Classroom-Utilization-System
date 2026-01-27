import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ClassroomManagement.css";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher"; // 'teacher' kept for backward compatibility
  department: string;
  gender: "male" | "female";
}

interface RegisteredUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher"; // 'teacher' kept for backward compatibility
  department: string;
  gender: "male" | "female";
  isActive: boolean;
  version?: number;
  lastLogin?: string;
  createdAt: string;
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
}

interface UserManagementProps {
  user: User;
  defaultTab?: "classrooms" | "users";
}

const UserManagement: React.FC<UserManagementProps> = ({
  user,
  defaultTab = "users",
}) => {
  const [activeTab, setActiveTab] = useState<"classrooms" | "users">(
    defaultTab,
  );

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
  const [showDeleteClassroomConfirm, setShowDeleteClassroomConfirm] =
    useState(false);
  const [classroomToDelete, setClassroomToDelete] = useState<{
    id: string;
  } | null>(null);
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
  });
  const [roomFilter, setRoomFilter] = useState<"all" | "comlab" | "non-comlab">(
    "all",
  );

  // User state
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [userToArchive, setUserToArchive] = useState<{
    id: string;
    name: string;
    version?: number;
  } | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [userToRestore, setUserToRestore] = useState<{
    id: string;
    name: string;
    version?: number;
  } | null>(null);
  const [editingUser, setEditingUser] = useState<RegisteredUser | null>(null);
  const [showEditUserForm, setShowEditUserForm] = useState(false);
  const [userFormData, setUserFormData] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    department: string;
    gender: "male" | "female";
    password: string;
    isActive: boolean;
  }>({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    gender: "male",
    password: "",
    isActive: true,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [versionConflict, setVersionConflict] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Update activeTab when defaultTab prop changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    fetchData();
  }, [activeTab, showArchived, page, pageSize, searchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      // Ensure token is available and set in axios defaults
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please log in again.");
        setLoading(false);
        return;
      }

      // Ensure axios defaults are set
      if (!axios.defaults.headers.common["Authorization"]) {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }

      if (activeTab === "classrooms") {
        const response = await axios.get("/api/classrooms");
        setClassrooms(response.data);

        // Fetch active time-ins (records without timeOut)
        try {
          const timeInResponse = await axios.get("/api/timein");
          const activeRecords = timeInResponse.data.filter(
            (record: any) => !record.timeOut,
          );
          setActiveTimeIns(activeRecords);
        } catch (timeInError) {
          // Time-in fetch is optional, don't fail the whole page
          console.warn("Could not fetch active time-ins:", timeInError);
          setActiveTimeIns([]);
        }
      } else {
        const response = await axios.get("/api/users", {
          params: {
            limit: pageSize,
            page,
            search: searchQuery || undefined,
          },
        });

        const data = response.data;
        const usersArray = Array.isArray(data) ? data : data.users || [];

        const filteredUsers = usersArray.filter((u: RegisteredUser) => {
          if (u.role === "admin") return false;
          return showArchived ? !u.isActive : u.isActive;
        });
        setUsers(filteredUsers);

        if (!Array.isArray(data) && data.pagination) {
          setTotalPages(data.pagination.pages || 1);
        } else {
          setTotalPages(1);
        }
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

    try {
      const classroomData: any = {
        ...classroomFormData,
      };

      // Include version for updates
      if (editingClassroom) {
        classroomData.version = editingClassroom.version;
        await axios.put(
          `/api/classrooms/${editingClassroom._id}`,
          classroomData,
        );
      } else {
        await axios.post("/api/classrooms", classroomData);
      }

      setShowClassroomForm(false);
      setEditingClassroom(null);
      setClassroomFormData({
        name: "",
        location: "",
        description: "",
        isAvailable: true,
      });
      fetchData();
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
    });
    setShowClassroomForm(true);
  };

  const handleDeleteClassroomClick = (classroom: Classroom) => {
    setClassroomToDelete({ id: classroom._id });
    setShowDeleteClassroomConfirm(true);
  };

  const handleDeleteClassroomConfirm = async () => {
    if (!classroomToDelete) return;

    try {
      await axios.delete(`/api/classrooms/${classroomToDelete.id}`);
      setSuccess("Classroom deleted successfully");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(
        error.response?.data?.message ||
          error.response?.data?.msg ||
          "Failed to delete classroom",
      );
      setTimeout(() => setError(""), 3000);
    } finally {
      setShowDeleteClassroomConfirm(false);
      setClassroomToDelete(null);
    }
  };

  const handleDeleteClassroomCancel = () => {
    setShowDeleteClassroomConfirm(false);
    setClassroomToDelete(null);
  };

  const handleCancelClassroom = () => {
    setShowClassroomForm(false);
    setEditingClassroom(null);
    setClassroomFormData({
      name: "",
      location: "",
      description: "",
      isAvailable: true,
    });
    setError("");
  };

  const handleViewSchedules = (classroom: Classroom) => {
    setViewingClassroom(classroom);
    setShowScheduleView(true);
  };

  const handleCloseScheduleView = () => {
    setShowScheduleView(false);
    setViewingClassroom(null);
    setIsEditingSchedules(false);
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

  // User handlers
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const userData = {
        firstName: userFormData.firstName,
        lastName: userFormData.lastName,
        email: userFormData.email,
        department: userFormData.department,
        isActive: userFormData.isActive,
        password: userFormData.password || "DefaultPassword123",
      };

      await axios.post("/api/users", userData);

      setSuccess("User created successfully!");
      setUserFormData({
        firstName: "",
        lastName: "",
        email: "",
        department: "",
        gender: "male",
        password: "",
        isActive: true,
      });

      // Refresh the user list and close the form
      fetchData();
      setShowUserForm(false);

      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to create user");
    }
  };

  const handleCancelUser = () => {
    setShowUserForm(false);
    setUserFormData({
      firstName: "",
      lastName: "",
      email: "",
      department: "",
      gender: "male",
      password: "",
      isActive: true,
    });
    setError("");
  };

  const handleEditUser = (userToEdit: RegisteredUser) => {
    setEditingUser(userToEdit);
    setUserFormData({
      firstName: userToEdit.firstName,
      lastName: userToEdit.lastName,
      email: userToEdit.email,
      department: userToEdit.department,
      gender: userToEdit.gender || "male",
      password: "",
      isActive: userToEdit.isActive,
    });
    setShowEditUserForm(true);
  };

  const handleSaveEditUser = async () => {
    if (
      !editingUser ||
      !userFormData.firstName ||
      !userFormData.lastName ||
      !userFormData.email
    ) {
      setError("First name, last name, and email are required");
      return;
    }

    try {
      setVersionConflict(false);
      const payload: any = {
        firstName: userFormData.firstName,
        lastName: userFormData.lastName,
        email: userFormData.email,
        department: userFormData.department,
        version: editingUser.version,
      };

      const response = await axios.put(
        `/api/users/${editingUser._id}`,
        payload,
      );

      setSuccess("User updated successfully!");
      setShowEditUserForm(false);
      setEditingUser(null);
      setUserFormData({
        firstName: "",
        lastName: "",
        email: "",
        department: "",
        gender: "male",
        password: "",
        isActive: true,
      });
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      const statusCode = error.response?.status;
      const responseData = error.response?.data;

      if (statusCode === 409) {
        const conflictMessage =
          responseData?.message ||
          "This user was updated by someone else. Please refresh and try again.";
        setVersionConflict(true);
        setError("⚠️ CONFLICT DETECTED:\n\n" + conflictMessage);
        return;
      }

      setError(error.response?.data?.message || "Failed to update user");
    }
  };

  const handleCancelEditUser = () => {
    setShowEditUserForm(false);
    setEditingUser(null);
    setUserFormData({
      firstName: "",
      lastName: "",
      email: "",
      department: "",
      gender: "male",
      password: "",
      isActive: true,
    });
  };

  const handleArchiveUser = (userItem: RegisteredUser) => {
    setUserToArchive({
      id: userItem._id,
      name: `${userItem.firstName} ${userItem.lastName}`,
      version: userItem.version,
    });
    setShowArchiveConfirm(true);
  };

  const handleArchiveConfirm = async () => {
    if (!userToArchive) return;
    if (userToArchive.version === undefined) {
      setError(
        "Unable to archive this user because version information is missing. Please refresh the page and try again.",
      );
      setShowArchiveConfirm(false);
      setUserToArchive(null);
      return;
    }

    try {
      await axios.put(`/api/users/${userToArchive.id}`, {
        isActive: false,
        version: userToArchive.version,
      });
      setSuccess("User archived successfully!");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to archive user");
    } finally {
      setShowArchiveConfirm(false);
      setUserToArchive(null);
    }
  };

  const handleArchiveCancel = () => {
    setShowArchiveConfirm(false);
    setUserToArchive(null);
  };

  const handleRestoreUser = (userItem: RegisteredUser) => {
    setUserToRestore({
      id: userItem._id,
      name: `${userItem.firstName} ${userItem.lastName}`,
      version: userItem.version,
    });
    setShowRestoreConfirm(true);
  };

  const handleRestoreConfirm = async () => {
    if (!userToRestore) return;
    if (userToRestore.version === undefined) {
      setError(
        "Unable to restore this user because version information is missing. Please refresh the page and try again.",
      );
      setShowRestoreConfirm(false);
      setUserToRestore(null);
      return;
    }

    try {
      await axios.put(`/api/users/${userToRestore.id}`, {
        isActive: true,
        version: userToRestore.version,
      });
      setSuccess("User restored successfully!");
      fetchData();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to restore user");
      setTimeout(() => setError(""), 3000);
    } finally {
      setShowRestoreConfirm(false);
      setUserToRestore(null);
    }
  };

  const handleRestoreCancel = () => {
    setShowRestoreConfirm(false);
    setUserToRestore(null);
  };

  // Filter users based on search query
  const filteredUsers = users.filter((userItem) => {
    const fullName = `${userItem.firstName} ${userItem.lastName}`.toLowerCase();
    const email = userItem.email.toLowerCase();
    const query = searchQuery.toLowerCase();

    return fullName.includes(query) || email.includes(query);
  });

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
      {activeTab === "users" && (
        <>
          <div className="page-header"></div>

          {error && <div className="error-message">{error}</div>}

          <div className="card">
            {success && <div className="success-message">{success}</div>}

            <div className="user-list-section">
              <div className="section-header">
                <h3 className="section-title">
                  {showArchived ? "Archived Users" : "Manage Users"}
                </h3>
                <div className="header-actions">
                  <button
                    className={`btn ${
                      showArchived ? "btn-secondary" : "btn-outline"
                    }`}
                    onClick={() => setShowArchived(!showArchived)}
                  >
                    {showArchived ? "Show Active Users" : "View Archived"}
                  </button>
                  {!showArchived && (
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowUserForm(true)}
                    >
                      Add User
                    </button>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="search-bar-container">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
                {searchQuery && (
                  <button
                    className="clear-search-btn"
                    onClick={() => {
                      setSearchQuery("");
                      setPage(1);
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="users-table">
                {filteredUsers.length === 0 ? (
                  <div className="no-classrooms">
                    <p>
                      {showArchived
                        ? "No archived users found."
                        : searchQuery
                          ? "No users match your search."
                          : "No users found."}
                    </p>
                  </div>
                ) : (
                  <>
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Department</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Last Login</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((userItem) => (
                          <tr key={userItem._id}>
                            <td>
                              {userItem.firstName} {userItem.lastName}
                            </td>
                            <td>{userItem.email}</td>
                            <td>{userItem.department}</td>
                            <td>
                              <span
                                className={`role-badge role-${userItem.role}`}
                              >
                                {userItem.role}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`status-badge ${
                                  userItem.isActive
                                    ? "status-approved"
                                    : "status-rejected"
                                }`}
                              >
                                {userItem.isActive ? "Active" : "Archived"}
                              </span>
                            </td>
                            <td>
                              {userItem.lastLogin
                                ? new Date(
                                    userItem.lastLogin,
                                  ).toLocaleDateString()
                                : "Never"}
                            </td>
                            <td className="action-buttons">
                              {showArchived ? (
                                <button
                                  className="btn btn-success btn-sm"
                                  onClick={() => handleRestoreUser(userItem)}
                                  title="Restore user"
                                >
                                  Restore
                                </button>
                              ) : (
                                <>
                                  <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => handleEditUser(userItem)}
                                    title="Edit user"
                                  >
                                    Edit
                                  </button>
                                  {userItem._id !== user.id && (
                                    <button
                                      className="btn btn-warning btn-sm"
                                      onClick={() =>
                                        handleArchiveUser(userItem)
                                      }
                                      title="Archive user"
                                    >
                                      Archive
                                    </button>
                                  )}
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div
                      className="pagination"
                      style={{
                        marginTop: "12px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        justifyContent: "flex-start",
                      }}
                    >
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </button>
                      <span>
                        Page {page} of {totalPages}
                      </span>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={page >= totalPages}
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
                      >
                        {[5, 10, 20, 50].map((size) => (
                          <option key={size} value={size}>
                            {size} / page
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Classrooms Tab */}
      {activeTab === "classrooms" && (
        <>
          <div className="page-header"></div>

          {error && <div className="error-message">{error}</div>}

          <div className="card">
            <div className="card-header">
              <h2>Classrooms</h2>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontWeight: 500,
                    fontSize: "1rem",
                  }}
                >
                  <span style={{ whiteSpace: "nowrap" }}>Room type:</span>
                  <select
                    value={roomFilter}
                    onChange={(e) =>
                      setRoomFilter(
                        e.target.value as "all" | "comlab" | "non-comlab",
                      )
                    }
                    style={{
                      padding: "0.4rem 0.6rem",
                      fontSize: "1rem",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                      minWidth: "140px",
                    }}
                  >
                    <option value="all">All</option>
                    <option value="comlab">ComLab</option>
                    <option value="non-comlab">Non-ComLab</option>
                  </select>
                </label>
                {!showClassroomForm && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setEditingClassroom(null);
                      setClassroomFormData({
                        name: "",
                        location: "",
                        description: "",
                        isAvailable: true,
                      });
                      setShowClassroomForm(true);
                    }}
                  >
                    Add Classroom
                  </button>
                )}
              </div>
            </div>

            {showClassroomForm && (
              <form onSubmit={handleClassroomSubmit} className="classroom-form">
                <h3>
                  {editingClassroom ? "Edit Classroom" : "Add New Classroom"}
                </h3>

                <div className="form-group">
                  <label htmlFor="name">Classroom Name</label>
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
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location</label>
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
                  />
                </div>

                <div className="form-group">
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
                  />
                </div>

                <div className="form-group">
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
                    Available for booking
                  </label>
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
                    {editingClassroom ? "Update" : "Create"} Classroom
                  </button>
                </div>
              </form>
            )}

            {!showClassroomForm && (
              <div className="classroom-grid">
                {(() => {
                  const isComlab = (room: Classroom) =>
                    /comlab/i.test(room.name) || /comlab/i.test(room.location);
                  const filteredClassrooms =
                    roomFilter === "all"
                      ? classrooms
                      : roomFilter === "comlab"
                        ? classrooms.filter(isComlab)
                        : classrooms.filter((room) => !isComlab(room));
                  return filteredClassrooms.length === 0 ? (
                    <div className="no-classrooms">
                      <p>
                        {roomFilter === "all"
                          ? "No classrooms found."
                          : roomFilter === "comlab"
                            ? "No ComLab classrooms found."
                            : "No non-ComLab classrooms found."}
                      </p>
                    </div>
                  ) : (
                    filteredClassrooms.map((classroom) => {
                      const inUse = isClassroomInUse(classroom._id);
                      return (
                        <div key={classroom._id} className="classroom-card">
                          <div className="classroom-header">
                            <h3>{classroom.name}</h3>
                          </div>

                          <div className="classroom-details">
                            <div className="detail-item">
                              <span className="detail-label">Location:</span>
                              <span className="detail-value">
                                {classroom.location}
                              </span>
                            </div>
                            {classroom.description && (
                              <div className="detail-item">
                                <span className="detail-label">
                                  Description:
                                </span>
                                <span className="detail-value">
                                  {classroom.description}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="classroom-actions">
                            <button
                              className="btn btn-primary"
                              onClick={() => handleViewSchedules(classroom)}
                            >
                              View
                            </button>
                            <button
                              className="btn btn-outline"
                              onClick={() => handleEditClassroom(classroom)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() =>
                                handleDeleteClassroomClick(classroom)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })
                  );
                })()}
              </div>
            )}
          </div>
        </>
      )}

      {/* Schedule View Modal */}
      {showScheduleView && viewingClassroom && (
        <div className="modal-overlay">
          <div className="schedule-view-modal">
            <h3 className="schedule-view-title">
              {viewingClassroom.name} Schedule
            </h3>

            {success && <div className="success-message">{success}</div>}
            {error && <div className="error-message">{error}</div>}

            <div className="schedule-header-actions">
              {!isEditingSchedules ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setIsEditingSchedules(true)}
                >
                  Edit Schedules
                </button>
              ) : (
                <button
                  className="btn btn-success"
                  onClick={handleSaveSchedules}
                >
                  Save Changes
                </button>
              )}
            </div>

            {isEditingSchedules && (
              <div className="add-schedule-form">
                <h4>Add New Schedule</h4>
                <div className="form-row">
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
                </div>
                <div className="form-row">
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
                </div>
                <div className="form-group">
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
                <button className="btn btn-outline" onClick={handleAddSchedule}>
                  Add Schedule
                </button>
              </div>
            )}

            {viewingClassroom.schedules &&
            viewingClassroom.schedules.length > 0 ? (
              <div className="schedule-table-container">
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
                        <td>{schedule.day}</td>
                        <td>{schedule.time}</td>
                        <td>{schedule.section}</td>
                        <td>{schedule.subjectCode}</td>
                        <td>{schedule.instructor}</td>
                        {isEditingSchedules && (
                          <td>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteSchedule(index)}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-schedules">
                No schedules assigned to this classroom.
              </p>
            )}

            <div className="schedule-view-buttons">
              {isEditingSchedules && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsEditingSchedules(false)}
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
      {showArchiveConfirm && userToArchive && (
        <div className="modal-overlay">
          <div className="archive-confirm-modal">
            <p className="archive-confirm-text">
              Are you sure you want to archive{" "}
              <strong>{userToArchive.name}</strong>? They will be moved to the
              archived users list.
            </p>
            <div className="archive-confirm-buttons">
              <button
                className="btn-confirm-yes"
                onClick={handleArchiveConfirm}
              >
                Yes
              </button>
              <button className="btn-confirm-no" onClick={handleArchiveCancel}>
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore User Confirmation Modal */}
      {showRestoreConfirm && userToRestore && (
        <div className="modal-overlay">
          <div className="archive-confirm-modal">
            <div className="modal-icon">♻️</div>
            <h3 className="modal-title">Restore User</h3>
            <p className="archive-confirm-text">
              Are you sure you want to restore{" "}
              <strong>{userToRestore.name}</strong>? They will be moved back to
              the active users list and will be able to log in again.
            </p>
            <div className="archive-confirm-buttons">
              <button
                className="btn-confirm-yes"
                onClick={handleRestoreConfirm}
              >
                Yes, Restore
              </button>
              <button className="btn-confirm-no" onClick={handleRestoreCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Classroom Confirmation Modal */}
      {showDeleteClassroomConfirm && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <h3>Delete Classroom</h3>
            <p>
              Are you sure you want to permanently delete this classroom? This
              action cannot be undone.
            </p>
            <div className="modal-buttons">
              <button
                className="btn-cancel"
                onClick={handleDeleteClassroomCancel}
              >
                Cancel
              </button>
              <button
                className="btn-confirm"
                onClick={handleDeleteClassroomConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Form Modal */}
      {showUserForm && (
        <div className="modal-overlay">
          <div className="confirm-modal" style={{ maxWidth: "600px" }}>
            <h3>Add New User</h3>
            <form
              onSubmit={handleUserSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "15px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "500",
                    }}
                  >
                    First Name
                  </label>
                  <input
                    type="text"
                    value={userFormData.firstName}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        firstName: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                    required
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "5px",
                      fontWeight: "500",
                    }}
                  >
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={userFormData.lastName}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        lastName: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      boxSizing: "border-box",
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, email: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Department
                </label>
                <input
                  type="text"
                  value={userFormData.department}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      department: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Gender
                </label>
                <select
                  value={userFormData.gender}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      gender: e.target.value as "male" | "female",
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                  required
                >
                  <option value="male">Boy</option>
                  <option value="female">Girl</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Password
                </label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      password: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                  placeholder="Leave blank for default"
                />
              </div>

              <small style={{ color: "#666" }}>
                Default Password: DefaultPassword123
              </small>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: "500",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={userFormData.isActive}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      isActive: e.target.checked,
                    })
                  }
                />
                Active Account
              </label>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={handleCancelUser}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Form Modal */}
      {showEditUserForm && editingUser && (
        <div className="modal-overlay">
          <div className="confirm-modal" style={{ maxWidth: "500px" }}>
            <h3>Edit User</h3>
            <form
              style={{ display: "flex", flexDirection: "column", gap: "15px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  First Name
                </label>
                <input
                  type="text"
                  value={userFormData.firstName}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      firstName: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Last Name
                </label>
                <input
                  type="text"
                  value={userFormData.lastName}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      lastName: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={userFormData.email}
                  onChange={(e) =>
                    setUserFormData({ ...userFormData, email: e.target.value })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Department
                </label>
                <input
                  type="text"
                  value={userFormData.department}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      department: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    fontWeight: "500",
                  }}
                >
                  Gender
                </label>
                <select
                  value={userFormData.gender}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      gender: e.target.value as "male" | "female",
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    boxSizing: "border-box",
                  }}
                  required
                >
                  <option value="male">Boy</option>
                  <option value="female">Girl</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                  marginTop: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={handleCancelEditUser}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditUser}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
