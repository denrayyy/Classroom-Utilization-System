import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AdminSettings.css";
import { User, Lock, Camera, Save, CheckCircle, Circle } from "lucide-react";

interface AdminSettingsProps {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePhoto?: string;
  };
  onBack: () => void;
  onUpdate: (updatedUser: any) => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({
  user,
  onBack,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
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
      </div>
    </div>
  );
};

export default AdminSettings;
