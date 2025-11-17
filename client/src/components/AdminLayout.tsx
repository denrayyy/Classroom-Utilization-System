import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AdminLayout.css';

interface AdminLayoutProps {
  children: React.ReactNode;
  fullName: string;
  onLogout?: () => void;
  profilePhoto?: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, fullName, onLogout, profilePhoto }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/schedules', label: 'Scheduling', icon: '📅' },
    { path: '/reports', label: 'Reports', icon: '📈' },
    { path: '/users', label: 'Manage Users', icon: '👥' },
    { path: '/classrooms', label: 'Manage Classroom', icon: '🏫' },
    { path: '/instructors', label: 'Manage Instructors', icon: '👨‍🏫' },
  ];

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirm(false);
    if (onLogout) {
      onLogout();
    }
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirm(false);
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    const currentPath = location.pathname;
    if (currentPath === '/') return 'Dashboard';
    if (currentPath === '/schedules') return 'Scheduling';
    if (currentPath === '/reports') return 'Reports';
    if (currentPath === '/users') return 'Manage Users';
    if (currentPath === '/classrooms') return 'Manage Classroom';
    if (currentPath === '/instructors') return 'Manage Instructors';
    return 'Dashboard';
  };

  return (
    <div className="admin-layout">
      {/* Topbar */}
      <header className="admin-topbar">
        <div className="topbar-left">
          <h1 className="page-title">{getPageTitle()}</h1>
        </div>
        <div className="topbar-right">
          <span className="admin-name">{fullName}</span>
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="profile-photo" />
          ) : (
            <div className="profile-photo-placeholder">
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="none">
                <circle cx="12" cy="8" r="3.5" stroke="#102a36" strokeWidth="1.8"/>
                <path d="M4 20c1.8-4 5-6 8-6s6.2 2 8 6" stroke="#102a36" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
          )}
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? '◀' : '▶'}
          </button>
          <div className="logo-container">
            <div className="logo" aria-hidden>
              <svg viewBox="0 0 64 64" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 56h16" stroke="#11303b" strokeWidth="4" strokeLinecap="round"/>
                <path d="M32 8c-9.389 0-17 7.611-17 17 0 6.06 3.087 11.382 7.78 14.5 1.689 1.114 2.22 2.654 2.22 4.5v2h16v-2c0-1.846.531-3.386 2.22-4.5C45.913 36.382 49 31.06 49 25c0-9.389-7.611-17-17-17Z" stroke="#11303b" strokeWidth="3"/>
                <path d="M26 42h12" stroke="#11303b" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            {isSidebarOpen && (
              <div className="brand-text">
                <div className="title">ClaUSys</div>
                <div className="subtitle">Admin Panel</div>
              </div>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item, index) => (
            <button
              key={index}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              {isSidebarOpen && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogoutClick}>
            <span className="logout-icon">🚪</span>
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main-content">
        {children}
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="logout-confirm-modal">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={handleLogoutCancel}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={handleLogoutConfirm}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;

