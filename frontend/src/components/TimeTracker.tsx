import React, { useState } from 'react';
import './TimeTracker.css';
import TimeIn from './TimeIn';

interface TimeTrackerProps {
  user: { _id: string; firstName: string; lastName: string; email: string; profilePhoto?: string };
  onLogout: () => void;
}

const TimeTracker: React.FC<TimeTrackerProps> = ({ user, onLogout }) => {
  const [showTimeIn, setShowTimeIn] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLogoutSuccess, setShowLogoutSuccess] = useState(false);

  const handleTimeIn = () => {
    setShowTimeIn(true);
  };

  const handleBack = () => {
    setShowTimeIn(false);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    setShowLogoutSuccess(true);
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  const handleLoginAgain = () => {
    onLogout();
  };

  if (showTimeIn) {
    return <TimeIn user={user} onBack={handleBack} />;
  }

  if (showLogoutSuccess) {
    return (
      <div className="logout-page">
        <div className="logout-container">
          <div className="logout-content">
            <div className="logout-logo">
              <svg viewBox="0 0 64 64" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 56h16" stroke="#11303b" strokeWidth="4" strokeLinecap="round"/>
                <path d="M32 8c-9.389 0-17 7.611-17 17 0 6.06 3.087 11.382 7.78 14.5 1.689 1.114 2.22 2.654 2.22 4.5v2h16v-2c0-1.846.531-3.386 2.22-4.5C45.913 36.382 49 31.06 49 25c0-9.389-7.611-17-17-17Z" stroke="#11303b" strokeWidth="3"/>
                <path d="M26 42h12" stroke="#11303b" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="logout-title">ClaUSys</h1>
            <p className="logout-subtitle">Classroom Utilization System</p>
            <p className="logout-message">Successfully Logged Out!</p>
            <button className="btn-login-again" onClick={handleLoginAgain}>Login Again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="time-page">
      <div className="time-content">
        <div className="time-actions">
          <button className="btn-time btn-in" onClick={handleTimeIn}>
            <span className="icon" aria-hidden>✔</span>
            <span>Time In</span>
          </button>
        </div>

        <button className="btn-logout" onClick={handleLogoutClick}>Logout</button>

        {showLogoutConfirm && (
          <div className="modal-overlay">
            <div className="logout-confirm-modal">
              <p className="logout-confirm-text">Are you sure you want to <strong>log-out</strong>?</p>
              <div className="logout-confirm-buttons">
                <button className="btn-confirm-yes" onClick={handleLogoutConfirm}>Yes</button>
                <button className="btn-confirm-no" onClick={handleLogoutCancel}>No</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeTracker;


