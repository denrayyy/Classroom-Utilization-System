import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./AdminLayout.css";

interface AdminLayoutProps {
  children: React.ReactNode;
  fullName: string;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  onSettingsClose?: () => void;
  showAdminSettings?: boolean;
  profilePhoto?: string;
  isSettingsActive?: boolean;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  fullName,
  onLogout,
  onSettingsClick,
  onSettingsClose,
  showAdminSettings,
  profilePhoto,
  isSettingsActive,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    { path: "/", label: "Dashboard", icon: "/dashboard.png" },
    { path: "/reports", label: "Reports", icon: "/reports.png" },
    { path: "/users", label: "Manage Users", icon: "/users.png" },
    { path: "/classrooms", label: "Manage Classroom", icon: "/classroom.png" },
    {
      path: "/instructors",
      label: "Manage Instructors",
      icon: "/instructor.png",
    },
    { path: "/activity-logs", label: "Activity Logs", icon: "/activity.png" },
    {
      path: "/settings",
      label: "Settings",
      icon: "/settings.png",
      onClick: onSettingsClick,
    },
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

  const isActive = (path: string, hasCustomHandler?: boolean) => {
    // If Settings is active, only highlight Settings
    if (isSettingsActive && !hasCustomHandler) {
      return false;
    }
    if (hasCustomHandler) {
      // Settings is active based on isSettingsActive prop
      return isSettingsActive || false;
    }
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    if (showAdminSettings) return "Settings";
    const currentPath = location.pathname;
    if (currentPath === "/") return "Dashboard";
    if (currentPath === "/schedules") return "Scheduling";
    if (currentPath === "/reports") return "Reports";
    if (currentPath === "/users") return "Manage Users";
    if (currentPath === "/classrooms") return "Manage Classroom";
    if (currentPath === "/instructors") return "Manage Instructors";
    if (currentPath === "/activity-logs") return "Activity Logs";
    return "Dashboard";
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
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="8"
                  r="3.5"
                  stroke="#102a36"
                  strokeWidth="1.8"
                />
                <path
                  d="M4 20c1.8-4 5-6 8-6s6.2 2 8 6"
                  stroke="#102a36"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`admin-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isSidebarOpen ? "◀" : "▶"}
          </button>
          <div className="logo-container">
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
              className={`nav-item ${isActive(item.path, !!item.onClick) ? "active" : ""}`}
              onClick={() => {
                if (item.onClick) {
                  item.onClick();
                } else {
                  onSettingsClose?.();
                  navigate(item.path);
                }
              }}
            >
              <img src={item.icon} alt={item.label} className="nav-icon" />
              {isSidebarOpen && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogoutClick}>
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main-content">{children}</main>

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
