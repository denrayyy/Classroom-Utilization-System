import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./AdminLayout.css";
import NotificationBell from "./NotificationBell";
import {
  LayoutDashboard,
  FileText,
  Users,
  Building,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
} from "lucide-react";

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
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/reports", label: "Reports", icon: FileText },
    { path: "/users", label: "Manage Users", icon: Users },
    { path: "/classrooms", label: "Manage Classroom", icon: Building },
    {
      path: "/settings",
      label: "Settings",
      icon: Settings,
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
    if (isSettingsActive && !hasCustomHandler) {
      return false;
    }
    if (hasCustomHandler) {
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
    if (currentPath === "/holidays") return "Holiday Management";
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
          <NotificationBell />
          <span className="admin-name">{fullName}</span>
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="profile-photo" />
          ) : (
            <div className="profile-photo-placeholder">
              <User size={20} />
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
            {isSidebarOpen ? (
              <ChevronLeft size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
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
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const active = isActive(item.path, !!item.onClick);
            return (
              <button
                key={index}
                className={`nav-item ${active ? "active" : ""}`}
                onClick={() => {
                  if (item.onClick) {
                    item.onClick();
                  } else {
                    onSettingsClose?.();
                    navigate(item.path);
                  }
                }}
              >
                <Icon size={22} className="nav-icon" />
                {isSidebarOpen && (
                  <span className="nav-label">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogoutClick}>
            <LogOut size={20} />
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
