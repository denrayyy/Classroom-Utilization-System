import React, { useState, useEffect } from "react";
import axios from "axios";
import "./UserManagement.css";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher";
  department: string;
  gender?: "male" | "female";
}

interface RegisteredUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher";
  department: string;
  gender?: "male" | "female";
  isActive: boolean;
  version?: number;
  lastLogin?: string;
  createdAt: string;
}

interface UserManagementProps {
  user?: User; // Make user optional
  defaultTab?: "users";
}

const UserManagement: React.FC<UserManagementProps> = ({
  user = {
    id: "",
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com",
    role: "admin",
    department: "IT",
  },
  defaultTab = "users",
}) => {
  // User state
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<RegisteredUser[]>([]);
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>([]);
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
    password: string;
    isActive: boolean;
  }>({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    password: "",
    isActive: true,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [versionConflict, setVersionConflict] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [totalArchived, setTotalArchived] = useState(0);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);

  // Fetch all users on mount and when filters change
  useEffect(() => {
    fetchAllUsers();
    fetchStats();
    fetchDepartments();
  }, [showArchived, roleFilter, departmentFilter]);

  // Filter users whenever search query or filters change
  useEffect(() => {
    filterUsers();
    setPage(1);
  }, [searchQuery, allUsers, showArchived, roleFilter, departmentFilter]);

  const fetchAllUsers = async () => {
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

      // Fetch ALL users (no pagination for filtering)
      const params: any = {
        limit: 1000, // Get a large limit for client-side filtering
        page: 1,
        isActive: showArchived ? "false" : "true",
      };

      if (roleFilter) params.role = roleFilter;
      if (departmentFilter) params.department = departmentFilter;

      const response = await axios.get("/api/users", { params });

      if (response.data.users) {
        setAllUsers(response.data.users);
        setTotalUsers(response.data.pagination?.total || 0);
        setTotalPages(
          Math.ceil((response.data.pagination?.total || 0) / pageSize),
        );
      } else {
        setAllUsers([]);
        setTotalUsers(0);
        setTotalPages(1);
      }
    } catch (error: any) {
      console.error("Error fetching users:", error);
      if (error.response?.status === 401 || error.response?.status === 403) {
        setError("Authentication failed. Please log in again.");
      } else {
        setError(error.response?.data?.message || "Failed to fetch users.");
      }
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...allUsers];

    // Apply search filter (client-side like Reports component)
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = user.email.toLowerCase();
        return fullName.includes(query) || email.includes(query);
      });
    }

    setFilteredUsers(filtered);
    setTotalUsers(filtered.length);
    setTotalPages(Math.ceil(filtered.length / pageSize));
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/users", {
        params: { limit: 1, isActive: "true" },
        headers: { Authorization: `Bearer ${token}` },
      });
      setTotalActive(response.data.pagination?.total || 0);

      const archivedResponse = await axios.get("/api/users", {
        params: { limit: 1, isActive: "false" },
        headers: { Authorization: `Bearer ${token}` },
      });
      setTotalArchived(archivedResponse.data.pagination?.total || 0);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/users/departments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDepartmentOptions(response.data);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

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
        password: "",
        isActive: true,
      });

      fetchAllUsers();
      fetchStats();
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
      password: "",
      isActive: userToEdit.isActive,
    });
    setShowEditUserForm(true);
    setShowUserForm(false);
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

      await axios.put(`/api/users/${editingUser._id}`, payload);

      setSuccess("User updated successfully!");
      setShowEditUserForm(false);
      setEditingUser(null);
      setUserFormData({
        firstName: "",
        lastName: "",
        email: "",
        department: "",
        password: "",
        isActive: true,
      });
      fetchAllUsers();
      fetchStats();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      if (error.response?.status === 409) {
        setVersionConflict(true);
        setError(
          "⚠️ This user was updated by someone else. Please refresh and try again.",
        );
      } else {
        setError(error.response?.data?.message || "Failed to update user");
      }
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
      setError("Version information missing. Please refresh and try again.");
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
      fetchAllUsers();
      fetchStats();
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
      setError("Version information missing. Please refresh and try again.");
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
      fetchAllUsers();
      fetchStats();
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to restore user");
    } finally {
      setShowRestoreConfirm(false);
      setUserToRestore(null);
    }
  };

  const handleRestoreCancel = () => {
    setShowRestoreConfirm(false);
    setUserToRestore(null);
  };

  const getRoleBadge = (role: string) => {
    const badges: Record<string, { class: string; icon: string }> = {
      admin: { class: "role-admin", icon: "👑" },
      teacher: { class: "role-teacher", icon: "👨‍🏫" },
      student: { class: "role-student", icon: "👨‍🎓" },
    };
    const badge = badges[role] || { class: "role-default", icon: "👤" };

    return (
      <span className={`role-badge ${badge.class}`}>
        <span className="role-icon">{badge.icon}</span>
        <span className="role-text">{role}</span>
      </span>
    );
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="status-badge status-active">
          <span className="status-text">✅ Active</span>
        </span>
      );
    }
    return (
      <span className="status-badge status-archived">
        <span className="status-icon">📦</span>
        <span className="status-text">Archived</span>
      </span>
    );
  };

  const formatLastLogin = (lastLogin?: string) => {
    if (!lastLogin) return "Never";
    const date = new Date(lastLogin);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Get paginated data for current page
  const getPaginatedUsers = () => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredUsers.slice(start, end);
  };

  if (loading && allUsers.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="page-header">
        <div className="header-content">
          <h1>User Management</h1>
          <p className="header-description">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="header-stats">
          <div className="stat-chip">
            <span className="stat-label">Active</span>
            <span className="stat-value">{totalActive}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Archived</span>
            <span className="stat-value">{totalArchived}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Page</span>
            <span className="stat-value">
              {page}/{totalPages}
            </span>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {versionConflict && (
        <div className="alert alert-warning">
          <div className="alert-content">
            <strong>⚠️ Data was updated elsewhere:</strong> The user data has
            been modified by another user.
          </div>
          <button className="btn btn-secondary" onClick={fetchAllUsers}>
            Refresh
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>
            <span className="header-icon">
              {showUserForm || showEditUserForm
                ? showEditUserForm
                  ? "✏️"
                  : "➕"
                : showArchived
                  ? "📦"
                  : "👥"}
            </span>
            {showUserForm || showEditUserForm
              ? showEditUserForm
                ? "Edit User"
                : "Add New User"
              : showArchived
                ? "Archived Users"
                : "Active Users"}
          </h2>

          {!showUserForm && !showEditUserForm && (
            <div className="header-actions">
              <button
                className={`btn ${showArchived ? "btn-secondary" : "btn-outline"}`}
                onClick={() => setShowArchived(!showArchived)}
              >
                <span className="btn-icon">{showArchived ? "👁️" : "📦"}</span>
                {showArchived
                  ? "Show Active"
                  : `View Archived (${totalArchived})`}
              </button>
              {!showArchived && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowUserForm(true);
                    setShowEditUserForm(false);
                  }}
                >
                  <span className="btn-icon">➕</span>
                  Add User
                </button>
              )}
            </div>
          )}
        </div>

        {/* Add User Inline Form */}
        {showUserForm && (
          <div className="form-container">
            <form onSubmit={handleUserSubmit} className="user-form">
              <h3>Add New User</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={userFormData.firstName}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        firstName: e.target.value,
                      })
                    }
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={userFormData.lastName}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        lastName: e.target.value,
                      })
                    }
                    placeholder="Enter last name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        email: e.target.value,
                      })
                    }
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value={userFormData.department}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        department: e.target.value,
                      })
                    }
                    placeholder="e.g., IT, EMC"
                  />
                </div>
                <div className="form-group full-width">
                  <label>Password</label>
                  <input
                    type="password"
                    value={userFormData.password}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        password: e.target.value,
                      })
                    }
                    placeholder="Leave blank for default"
                  />
                  <small className="form-hint">
                    Default: DefaultPassword123
                  </small>

                  {/* Checkbox placed right after password hint */}
                  <div
                    className="checkbox-wrapper"
                    style={{ marginTop: "16px" }}
                  >
                    <label className="checkbox-label">
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
                      <span>Active Account</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelUser}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Edit User Inline Form */}
        {showEditUserForm && editingUser && (
          <div className="form-container">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveEditUser();
              }}
              className="user-form"
            >
              <h3>Edit User</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={userFormData.firstName}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        firstName: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={userFormData.lastName}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        lastName: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={userFormData.email}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        email: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    value={userFormData.department}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        department: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-group full-width">
                  <div className="checkbox-wrapper">
                    <label className="checkbox-label">
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
                      <span>Active Account</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelEditUser}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Only show filters and table when NOT in add/edit mode */}
        {!showUserForm && !showEditUserForm && (
          <>
            <div className="filters-section">
              <div className="search-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="search-clear"
                    onClick={() => setSearchQuery("")}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="filter-group">
                <select
                  className="filter-select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="">All Roles</option>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="filter-group">
                <select
                  className="filter-select"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {(searchQuery || roleFilter || departmentFilter) && (
                <button
                  className="btn-clear-filters"
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("");
                    setDepartmentFilter("");
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="table-container">
              {filteredUsers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    {showArchived ? "📦" : "👥"}
                  </div>
                  <h3>No Users Found</h3>
                  <p>
                    {showArchived
                      ? "No archived users available."
                      : searchQuery || roleFilter || departmentFilter
                        ? "Try adjusting your filters to see more results."
                        : "Get started by adding your first user."}
                  </p>
                  {!showArchived &&
                    !searchQuery &&
                    !roleFilter &&
                    !departmentFilter && (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setShowUserForm(true);
                          setShowEditUserForm(false);
                        }}
                      >
                        Add User
                      </button>
                    )}
                </div>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Department</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Last Login</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getPaginatedUsers().map((userItem) => (
                          <tr key={userItem._id}>
                            <td className="user-cell">
                              <div className="user-avatar">
                                {userItem.firstName.charAt(0)}
                                {userItem.lastName.charAt(0)}
                              </div>
                              <div className="user-info">
                                <div className="user-name">
                                  {userItem.firstName} {userItem.lastName}
                                </div>
                                <div className="user-email">
                                  {userItem.email}
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="department-badge">
                                {userItem.department || "—"}
                              </span>
                            </td>
                            <td>{getRoleBadge(userItem.role)}</td>
                            <td>{getStatusBadge(userItem.isActive)}</td>
                            <td>
                              <span className="last-login">
                                {formatLastLogin(userItem.lastLogin)}
                              </span>
                            </td>
                            <td className="actions-cell">
                              {showArchived ? (
                                <button
                                  className="btn-icon-label success"
                                  onClick={() => handleRestoreUser(userItem)}
                                  title="Restore user"
                                >
                                  <span className="btn-icon">♻️</span>
                                  Restore
                                </button>
                              ) : (
                                <div className="action-buttons">
                                  <button
                                    className="btn-icon-label"
                                    onClick={() => {
                                      handleEditUser(userItem);
                                      setShowEditUserForm(true);
                                    }}
                                    title="Edit user"
                                  >
                                    <span className="btn-icon">✏️</span>
                                    Edit
                                  </button>
                                  {userItem._id !== user.id && (
                                    <button
                                      className="btn-icon-label warning"
                                      onClick={() =>
                                        handleArchiveUser(userItem)
                                      }
                                      title="Archive user"
                                    >
                                      <span className="btn-icon">📦</span>
                                      Archive
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="pagination-section">
                      <div className="pagination-info">
                        Showing {(page - 1) * pageSize + 1} to{" "}
                        {Math.min(page * pageSize, filteredUsers.length)} of{" "}
                        {filteredUsers.length} users
                      </div>
                      <div className="pagination-controls">
                        <button
                          className="btn-pagination"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => p - 1)}
                        >
                          ← Prev
                        </button>
                        <div className="page-numbers">
                          {[...Array(Math.min(5, totalPages))].map((_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) pageNum = i + 1;
                            else if (page <= 3) pageNum = i + 1;
                            else if (page >= totalPages - 2)
                              pageNum = totalPages - 4 + i;
                            else pageNum = page - 2 + i;
                            return (
                              <button
                                key={pageNum}
                                className={`btn-page ${page === pageNum ? "active" : ""}`}
                                onClick={() => setPage(pageNum)}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          className="btn-pagination"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => p + 1)}
                        >
                          Next →
                        </button>
                        <select
                          className="page-size-select"
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setPage(1);
                          }}
                        >
                          <option value={10}>10 / page</option>
                          <option value={25}>25 / page</option>
                          <option value={50}>50 / page</option>
                          <option value={100}>100 / page</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Archive Confirmation Modal */}
      {showArchiveConfirm && userToArchive && (
        <div className="modal-overlay">
          <div className="modal-content confirm-modal">
            <div className="modal-header">
              <h3>
                <span className="modal-icon">📦</span>
                Archive User
              </h3>
              <button className="modal-close" onClick={handleArchiveCancel}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                Are you sure you want to archive{" "}
                <strong>{userToArchive.name}</strong>?
              </p>
              <p className="warning-text">
                Archived users cannot log in and will be moved to the archived
                list.
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
                Archive User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && userToRestore && (
        <div className="modal-overlay">
          <div className="modal-content confirm-modal">
            <div className="modal-header">
              <h3>
                <span className="modal-icon">♻️</span>
                Restore User
              </h3>
              <button className="modal-close" onClick={handleRestoreCancel}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-text">
                Are you sure you want to restore{" "}
                <strong>{userToRestore.name}</strong>?
              </p>
              <p className="info-text">
                The user will be able to log in again and will appear in active
                user lists.
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
                Restore User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
