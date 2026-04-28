import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AdminSettings.css";
import {
  User,
  Lock,
  Camera,
  Save,
  CheckCircle,
  Circle,
  History,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AdminSettingsProps {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePhoto?: string;
    role?: string;
  };
  onBack: () => void;
  onUpdate: (updatedUser: any) => void;
}

interface ActivityLogItem {
  _id: string;
  user?: {
    firstName?: string;
    lastName?: string;
  };
  action: string;
  details?: string;
  entityName?: string;
  entityType?: string;
  createdAt: string;
}

interface ReportHeaderSettings {
  semester: string;
  academicYearStart: string;
  academicYearEnd: string;
  label?: string;
}

interface DocumentControlSettings {
  documentCode: string;
  revisionNo: number;
  issueDate: string;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({
  user,
  onBack,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<"profile" | "password" | "activity" | "reports">("profile");
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize] = useState(10);
  const [activityTotalPages, setActivityTotalPages] = useState(1);
  const [activityDateRange, setActivityDateRange] = useState({
    start: "",
    end: "",
  });
  const [reportHeader, setReportHeader] = useState<ReportHeaderSettings>({
    semester: "2nd Semester",
    academicYearStart: "2025",
    academicYearEnd: "2026",
  });
  const [documentControl, setDocumentControl] =
    useState<DocumentControlSettings>({
      documentCode: "OVPAA-F-INS-068",
      revisionNo: 0,
      issueDate: "2024-10-09",
    });

  useEffect(() => {
    const backendUrl = "http://localhost:5000";
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    if (user.profilePhoto) {
      setPreviewUrl(
        user.profilePhoto.startsWith("http")
          ? user.profilePhoto
          : `${backendUrl}${user.profilePhoto}`,
      );
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "activity") {
      fetchActivityLogs();
    }
  }, [activeTab, activityPage, activityDateRange.start, activityDateRange.end]);

  useEffect(() => {
    fetchReportHeaderSettings();
    if (user.role === "admin") {
      fetchDocumentControlSettings();
    }
  }, []);

  const fetchActivityLogs = async () => {
    try {
      setActivityLoading(true);
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/activity-logs", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: activityPage,
          limit: activityPageSize,
          startDate: activityDateRange.start || undefined,
          endDate: activityDateRange.end || undefined,
        },
      });

      setActivityLogs(response.data.logs || []);
      setActivityTotalPages(response.data.pagination?.pages || 1);
    } catch (error: any) {
      console.error("Activity logs fetch error:", error);
      setError(error.response?.data?.message || "Failed to load activity logs.");
    } finally {
      setActivityLoading(false);
    }
  };

  const formatActivityDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getActivityUser = (log: ActivityLogItem) => {
    const fullName = `${log.user?.firstName || ""} ${log.user?.lastName || ""}`.trim();
    return fullName || "System";
  };

  const getActivityDetails = (log: ActivityLogItem) => {
    if (log.details?.trim()) return log.details.trim();
    if (log.entityName?.trim()) return `${log.entityType || "Record"}: ${log.entityName.trim()}`;
    if (log.entityType?.trim()) return log.entityType.trim();
    return "No details available";
  };

  const fetchReportHeaderSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/system-settings/report-header", {
        headers: { Authorization: `Bearer ${token}` },
      });

      setReportHeader({
        semester: response.data?.semester || "2nd Semester",
        academicYearStart: response.data?.academicYearStart || "2025",
        academicYearEnd: response.data?.academicYearEnd || "2026",
      });
    } catch (error) {
      console.error("Failed to fetch report header settings:", error);
    }
  };

  const handleReportHeaderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      await axios.put("/api/system-settings/report-header", reportHeader, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess("Report header settings updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(
        error.response?.data?.message ||
          "Failed to update report header settings.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentControlSettings = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get("/api/system-settings", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const parsedIssueDate = response.data?.issueDate
        ? new Date(response.data.issueDate).toISOString().split("T")[0]
        : "2024-10-09";

      setDocumentControl({
        documentCode: response.data?.documentCode || "OVPAA-F-INS-068",
        revisionNo:
          typeof response.data?.revisionNo === "number"
            ? response.data.revisionNo
            : 0,
        issueDate: parsedIssueDate,
      });
    } catch (error) {
      console.error("Failed to fetch document control settings:", error);
    }
  };

  const handleDocumentControlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      await axios.put("/api/system-settings", documentControl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSuccess("Document control settings updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(
        error.response?.data?.message ||
          "Failed to update document control settings.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      setProfilePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("email", email);
      if (profilePhoto) {
        formData.append("profilePhoto", profilePhoto);
      }

      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Profile updated successfully!");
        if (data.user.profilePhoto) {
          setPreviewUrl(data.user.profilePhoto);
        }
        onUpdate(data.user);
        setProfilePhoto(null);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || "Failed to update profile");
      }
    } catch (error: any) {
      console.error("Profile update error:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword) {
      setError("Please enter your current password");
      return;
    }

    if (!newPassword) {
      setError("Please enter a new password");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "/api/auth/change-password",
        {
          currentPassword,
          newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      setSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(
        error.response?.data?.message ||
          "Failed to change password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <div className="admin-settings">
      <div className="content-header">
        <h1>Account Settings</h1>
        <p className="content-description">
          Manage your profile and security preferences
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="settings-card">
        {/* Tabs */}
        <div className="settings-tabs">
          <button
            className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={18} className="tab-icon" />
            Profile Information
          </button>
          <button
            className={`tab-btn ${activeTab === "password" ? "active" : ""}`}
            onClick={() => setActiveTab("password")}
          >
            <Lock size={18} className="tab-icon" />
            Security & Password
          </button>
          <button
            className={`tab-btn ${activeTab === "activity" ? "active" : ""}`}
            onClick={() => {
              setActivityPage(1);
              setActiveTab("activity");
            }}
          >
            <History size={18} className="tab-icon" />
            Activity Logs
          </button>
          <button
            className={`tab-btn ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            <Save size={18} className="tab-icon" />
            Report Settings
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <form onSubmit={handleProfileSubmit}>
            {/* Profile Photo Section */}
            <div className="photo-section">
              <div className="avatar-large">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`${firstName} ${lastName}`}
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {getInitials(firstName, lastName)}
                  </div>
                )}
              </div>
              <div className="upload-controls">
                <input
                  type="file"
                  id="profilePhoto"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="file-input"
                />
                <label htmlFor="profilePhoto" className="upload-label">
                  <Camera size={16} />
                  Change Photo
                </label>
                <p className="upload-hint">JPG, PNG or GIF. Max 5MB.</p>
              </div>
            </div>

            {/* Personal Information Form */}
            <div className="form-grid">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter your last name"
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
                <small className="form-hint">
                  This email will be used for notifications and login
                </small>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onBack}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner-small"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Password Tab */}
        {activeTab === "password" && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="password-section">
              <h3>Change Password</h3>
              <p className="section-description">
                Your password should be at least 6 characters long and unique.
              </p>

              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    disabled={loading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    disabled={loading}
                    required
                    minLength={6}
                  />
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    disabled={loading}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* Password Requirements */}
              <div className="requirements-box">
                <p className="requirements-title">Password requirements:</p>
                <ul className="requirements-list">
                  <li className={newPassword.length >= 6 ? "met" : ""}>
                    <span className="requirement-icon">
                      {newPassword.length >= 6 ? (
                        <CheckCircle size={14} color="#27ae60" />
                      ) : (
                        <Circle size={14} color="rgba(255,255,255,0.3)" />
                      )}
                    </span>
                    At least 6 characters
                  </li>
                  <li
                    className={
                      newPassword !== "" && newPassword === confirmPassword
                        ? "met"
                        : ""
                    }
                  >
                    <span className="requirement-icon">
                      {newPassword !== "" && newPassword === confirmPassword ? (
                        <CheckCircle size={14} color="#27ae60" />
                      ) : (
                        <Circle size={14} color="rgba(255,255,255,0.3)" />
                      )}
                    </span>
                    Passwords match
                  </li>
                  <li
                    className={
                      currentPassword !== "" && currentPassword !== newPassword
                        ? "met"
                        : ""
                    }
                  >
                    <span className="requirement-icon">
                      {currentPassword !== "" &&
                      currentPassword !== newPassword ? (
                        <CheckCircle size={14} color="#27ae60" />
                      ) : (
                        <Circle size={14} color="rgba(255,255,255,0.3)" />
                      )}
                    </span>
                    Different from current password
                  </li>
                </ul>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onBack}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner-small"></span>
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock size={16} />
                    Update Password
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {activeTab === "activity" && (
          <div className="activity-settings-section">
            <div className="activity-settings-header">
              <div>
                <h3>Activity Logs</h3>
                <p className="section-description">
                  Review recent admin activity and audit history.
                </p>
              </div>
            </div>

            <div className="activity-filters">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={activityDateRange.start}
                  onChange={(e) => {
                    setActivityPage(1);
                    setActivityDateRange((prev) => ({
                      ...prev,
                      start: e.target.value,
                    }));
                  }}
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={activityDateRange.end}
                  onChange={(e) => {
                    setActivityPage(1);
                    setActivityDateRange((prev) => ({
                      ...prev,
                      end: e.target.value,
                    }));
                  }}
                />
              </div>
            </div>

            <div className="activity-table-wrap">
              <table className="activity-settings-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLoading ? (
                    <tr>
                      <td colSpan={4} className="activity-table-empty">
                        Loading activity logs...
                      </td>
                    </tr>
                  ) : activityLogs.length ? (
                    activityLogs.map((log) => (
                      <tr key={log._id}>
                        <td>{formatActivityDate(log.createdAt)}</td>
                        <td>{getActivityUser(log)}</td>
                        <td>
                          <span className="activity-action-pill">
                            {String(log.action || "").toUpperCase()}
                          </span>
                        </td>
                        <td>{getActivityDetails(log)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="activity-table-empty">
                        No activity logs found for the selected range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="activity-pagination">
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setActivityPage((prev) => Math.max(1, prev - 1))}
                disabled={activityPage === 1 || activityLoading}
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <span className="pagination-status">
                Page {activityPage} of {Math.max(1, activityTotalPages)}
              </span>
              <button
                type="button"
                className="pagination-btn"
                onClick={() =>
                  setActivityPage((prev) =>
                    Math.min(activityTotalPages || 1, prev + 1),
                  )
                }
                disabled={activityPage >= activityTotalPages || activityLoading}
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
        {activeTab === "reports" && (
          <div>
            <form onSubmit={handleReportHeaderSubmit}>
            <div className="password-section">
              <h3>Report Header</h3>
              <p className="section-description">
                Set the semester and academic year shown in Reports and DOCX exports.
              </p>

              <div className="form-grid">
                <div className="form-group">
                  <label>Semester</label>
                  <select
                    value={reportHeader.semester}
                    onChange={(e) =>
                      setReportHeader((prev) => ({
                        ...prev,
                        semester: e.target.value,
                      }))
                    }
                    disabled={loading}
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                    <option value="Summer">Summer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Academic Year Start</label>
                  <input
                    type="text"
                    value={reportHeader.academicYearStart}
                    onChange={(e) =>
                      setReportHeader((prev) => ({
                        ...prev,
                        academicYearStart: e.target.value,
                      }))
                    }
                    placeholder="2025"
                    disabled={loading}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Academic Year End</label>
                  <input
                    type="text"
                    value={reportHeader.academicYearEnd}
                    onChange={(e) =>
                      setReportHeader((prev) => ({
                        ...prev,
                        academicYearEnd: e.target.value,
                      }))
                    }
                    placeholder="2026"
                    disabled={loading}
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Preview</label>
                  <div className="report-header-preview">
                    {reportHeader.semester} AY: {reportHeader.academicYearStart} - {reportHeader.academicYearEnd}
                  </div>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onBack}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="loading-spinner-small"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Report Settings
                  </>
                )}
              </button>
            </div>
            </form>

            {user.role === "admin" && (
              <form onSubmit={handleDocumentControlSubmit}>
                <div className="password-section" style={{ marginTop: "24px" }}>
                  <h3>Document Control Metadata</h3>
                  <p className="section-description">
                    Manage footer metadata used in DOCX exports.
                  </p>

                  <div className="form-grid">
                    <div className="form-group">
                      <label>Document Code</label>
                      <input
                        type="text"
                        value={documentControl.documentCode}
                        onChange={(e) =>
                          setDocumentControl((prev) => ({
                            ...prev,
                            documentCode: e.target.value,
                          }))
                        }
                        placeholder="OVPAA-F-INS-068"
                        disabled={loading}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Revision No.</label>
                      <input
                        type="number"
                        value={documentControl.revisionNo}
                        onChange={(e) =>
                          setDocumentControl((prev) => ({
                            ...prev,
                            revisionNo: Number(e.target.value),
                          }))
                        }
                        min={0}
                        disabled={loading}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Issue Date</label>
                      <input
                        type="date"
                        value={documentControl.issueDate}
                        onChange={(e) =>
                          setDocumentControl((prev) => ({
                            ...prev,
                            issueDate: e.target.value,
                          }))
                        }
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onBack}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="loading-spinner-small"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Document Control
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSettings;
