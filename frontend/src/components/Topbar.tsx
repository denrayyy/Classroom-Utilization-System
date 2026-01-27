import React from 'react';
import './Topbar.css';

interface TopbarProps {
  fullName: string;
  onLogout: () => void;
  onProfileClick?: () => void;
  profilePhoto?: string;
}

const Topbar: React.FC<TopbarProps> = ({ fullName, onProfileClick, profilePhoto }) => {

  return (
    <header className="admin-header" style={{ position: 'relative' }}>
      <div className="brand">
        <div className="logo" aria-hidden>
          <svg viewBox="0 0 64 64" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 56h16" stroke="#11303b" strokeWidth="4" strokeLinecap="round"/>
            <path d="M32 8c-9.389 0-17 7.611-17 17 0 6.06 3.087 11.382 7.78 14.5 1.689 1.114 2.22 2.654 2.22 4.5v2h16v-2c0-1.846.531-3.386 2.22-4.5C45.913 36.382 49 31.06 49 25c0-9.389-7.611-17-17-17Z" stroke="#11303b" strokeWidth="3"/>
            <path d="M26 42h12" stroke="#11303b" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="brand-text">
          <div className="title">ClaUSys</div>
          <div className="subtitle">Classroom Utilization System</div>
        </div>
      </div>
      <div className="user" onClick={onProfileClick} style={{ cursor: onProfileClick ? 'pointer' : 'default' }}>
        <span className="name">{fullName}</span>
        <div className="avatar" aria-label="Profile">
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none">
              <circle cx="12" cy="8" r="3.5" stroke="#102a36" strokeWidth="1.8"/>
              <path d="M4 20c1.8-4 5-6 8-6s6.2 2 8 6" stroke="#102a36" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;


