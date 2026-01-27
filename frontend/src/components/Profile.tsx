import React, { useState, useEffect } from 'react';
import './Profile.css';

interface ProfileProps {
  user: { 
    _id: string;
    firstName: string; 
    lastName: string; 
    email: string;
    profilePhoto?: string;
  };
  onBack: () => void;
  onUpdate: (updatedUser: any) => void;
  onChangePassword?: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onBack, onUpdate, onChangePassword }) => {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Initialize and sync form fields with user data
  useEffect(() => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEmail(user.email);
    if (user.profilePhoto) {
      setPreviewUrl(user.profilePhoto);
    }
  }, [user]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setProfilePhoto(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('email', email);
      if (profilePhoto) {
        formData.append('profilePhoto', profilePhoto);
      }

      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Profile updated successfully!');
        // Update the preview URL with the new photo from server
        if (data.user.profilePhoto) {
          setPreviewUrl(data.user.profilePhoto);
        }
        onUpdate(data.user);
        // Clear the file input after successful upload
        setProfilePhoto(null);
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-card">
          <div className="profile-card-header">
            <button className="back-button" onClick={onBack}>
              ← Profile
            </button>
          </div>

          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="profile-layout">
              <div className="profile-photo-section">
                <div className="profile-info-mini">
                  <div className="avatar-mini">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Profile" />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="8" r="4" stroke="#666" strokeWidth="2"/>
                        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="#666" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="profile-name-mini">{firstName} {lastName}</h3>
                    <p className="profile-email-mini">{email}</p>
                  </div>
                </div>

                <div className="profile-avatar-large">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Profile" className="avatar-preview" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="8" r="4" stroke="#ccc" strokeWidth="2"/>
                      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  )}
                </div>

                <input
                  type="file"
                  id="profilePhoto"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="file-input-hidden"
                />
                <button 
                  type="button" 
                  className="upload-photo-btn"
                  onClick={() => document.getElementById('profilePhoto')?.click()}
                >
                  Upload Photo
                </button>
              </div>

              <div className="profile-fields-section">
                <button type="submit" className="save-btn" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>

                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    placeholder="Enter your first name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Enter your last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email:</label>
                  <input
                    type="email"
                    placeholder="Enter your Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button 
                  type="button" 
                  className="change-password-btn"
                  onClick={onChangePassword}
                >
                  Change Password
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;

