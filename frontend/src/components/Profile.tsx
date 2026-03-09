import React, { useState, useEffect } from "react";
import "./Profile.css";

interface ProfileProps {
  user: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePhoto?: string;
    role?: string;
    department?: string;
    createdAt?: string;
  };
  onBack: () => void;
  onUpdate: (updatedUser: any) => void;
  onChangePassword?: () => void;
}

const Profile: React.FC<ProfileProps> = ({
  user,
  onBack,
  onUpdate,
  onChangePassword,
}) => {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    if (user.profilePhoto) {
      setPreviewUrl(user.profilePhoto);
    }
  }, [user]);

  const getInitials = () => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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

  const handleSubmit = async (e: React.FormEvent) => {
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
        setIsEditing(false);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Profile update error:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    setPreviewUrl(user.profilePhoto || "");
    setProfilePhoto(null);
    setIsEditing(false);
    setError("");
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <button className="back-btn" onClick={onBack}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to Dashboard
          </button>
          <h1>My Profile</h1>
          <p className="profile-subtitle">
            Manage your personal information and account settings
          </p>
        </div>

        {error && (
          <div className="alert error">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M12 8V12M12 16H12.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert success">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M20 6L9 17L4 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <div className="profile-content">
          {/* Profile Sidebar */}
          <div className="profile-sidebar">
            <div className="profile-avatar-section">
              <div className="avatar-large">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`${firstName} ${lastName}`}
                    className="avatar-image"
                  />
                ) : (
                  <div className="avatar-placeholder">{getInitials()}</div>
                )}
              </div>

              {!isEditing ? (
                <div className="profile-info">
                  <h2 className="profile-name">
                    {firstName} {lastName}
                  </h2>
                  <p className="profile-role">{user.role || "Student"}</p>
                  <p className="profile-email">{email}</p>
                  {user.department && (
                    <p className="profile-department">
                      <span className="info-label">Department:</span>{" "}
                      {user.department}
                    </p>
                  )}
                  {user.createdAt && (
                    <p className="profile-member-since">
                      <span className="info-label">Member since:</span>{" "}
                      {formatDate(user.createdAt)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="profile-upload">
                  <input
                    type="file"
                    id="profilePhoto"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="file-input"
                  />
                  <label htmlFor="profilePhoto" className="upload-label">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M23 19C23 19.5304 22.7893 20.0391 22.4142 20.4142C22.0391 20.7893 21.5304 21 21 21H3C2.46957 21 1.96086 20.7893 1.58579 20.4142C1.21071 20.0391 1 19.5304 1 19V8C1 7.46957 1.21071 6.96086 1.58579 6.58579C1.96086 6.21071 2.46957 6 3 6H7L9 3H15L17 6H21C21.5304 6 22.0391 6.21071 22.4142 6.58579C22.7893 6.96086 23 7.46957 23 8V19Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="13"
                        r="4"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                    Change Photo
                  </label>
                  <p className="upload-hint">JPG, PNG or GIF. Max 5MB.</p>
                </div>
              )}
            </div>

            <div className="profile-actions">
              {!isEditing ? (
                <>
                  <button
                    className="btn-edit"
                    onClick={() => setIsEditing(true)}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M17 3C17.2626 2.73735 17.5744 2.52901 17.9176 2.38687C18.2608 2.24473 18.6286 2.17157 19 2.17157C19.3714 2.17157 19.7392 2.24473 20.0824 2.38687C20.4256 2.52901 20.7374 2.73735 21 3C21.2626 3.26264 21.471 3.57444 21.6131 3.9176C21.7553 4.26077 21.8284 4.62856 21.8284 5C21.8284 5.37143 21.7553 5.73923 21.6131 6.08239C21.471 6.42555 21.2626 6.73735 21 7L8 20L3 21L4 16L17 3Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Edit Profile
                  </button>
                  {onChangePassword && (
                    <button className="btn-password" onClick={onChangePassword}>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <rect
                          x="3"
                          y="11"
                          width="18"
                          height="11"
                          rx="2"
                          ry="2"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                      Change Password
                    </button>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {/* Main Content */}
          <div className="profile-main">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="profile-form">
                <div className="form-header">
                  <h2>Edit Profile</h2>
                  <p>Update your personal information below</p>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="firstName">First Name</label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="lastName">Last Name</label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                      required
                    />
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="email">Email Address</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-save" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner-small"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H16L21 8V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M17 21V13H7V21"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                          <path
                            d="M7 3V8H15"
                            stroke="currentColor"
                            strokeWidth="2"
                          />
                        </svg>
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-view">
                <div className="view-header">
                  <h2>Profile Information</h2>
                  <p>Your personal details and account information</p>
                </div>

                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Full Name</span>
                    <span className="info-value">
                      {firstName} {lastName}
                    </span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Email Address</span>
                    <span className="info-value">{email}</span>
                  </div>

                  <div className="info-item">
                    <span className="info-label">Account Type</span>
                    <span className="info-value capitalize">
                      {user.role || "Student"}
                    </span>
                  </div>

                  {user.department && (
                    <div className="info-item">
                      <span className="info-label">Department</span>
                      <span className="info-value">{user.department}</span>
                    </div>
                  )}

                  {user.createdAt && (
                    <div className="info-item full-width">
                      <span className="info-label">Member Since</span>
                      <span className="info-value">
                        {formatDate(user.createdAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
