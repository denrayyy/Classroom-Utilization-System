import React, { useState, useEffect } from "react";
import "./Profile.css";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Camera,
  Pencil,
  Lock,
  Save,
  X,
} from "lucide-react";

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
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          <h1>My Profile</h1>
          <p className="profile-subtitle">
            Manage your personal information and account settings
          </p>
        </div>

        {error && (
          <div className="alert error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert success">
            <CheckCircle size={20} />
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
                    <Camera size={18} />
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
                    <Pencil size={18} />
                    Edit Profile
                  </button>
                  {onChangePassword && (
                    <button className="btn-password" onClick={onChangePassword}>
                      <Lock size={18} />
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
                    <X size={18} />
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
                        <Save size={18} />
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
