import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import axios from "axios";
import "./App.css";

// Components
import Login from "./components/Login";
import AdminLogin from "./components/AdminLogin";
import Landing from "./components/Landing";
import ForgotPassword from "./components/ForgotPassword";
import VerifyCode from "./components/VerifyCode";
import ResetPassword from "./components/ResetPassword";
// removed Register and Dashboard (not used)
import TimeTracker from "./components/TimeTracker";
import ClassroomManagement from "./components/ClassroomManagement";
import UserManagement from "./components/UserManagement";
import InstructorManagement from "./components/InstructorManagement";
import ScheduleManagement from "./components/ScheduleManagement";
import ClassroomUsage from "./components/ClassroomUsage";
import Monitoring from "./components/Monitoring";
import Reports from "./components/Reports";
import AdminDashboard from "./components/AdminDashboard";
import AdminLayout from "./components/AdminLayout";
import Topbar from "./components/Topbar";
import Profile from "./components/Profile";
import ChangePasswordModal from "./components/ChangePasswordModal";
import AdminSettings from "./components/AdminSettings";
import ActivityLogs from "./components/ActivityLogs";

// Types
interface User {
  _id: string;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher"; // 'teacher' kept for backward compatibility
  employeeId: string;
  department: string;
  gender: "male" | "female";
  phone?: string;
  profilePhoto?: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAdminSettings, setShowAdminSettings] = useState(false);

  useEffect(() => {
    // Check if user has a valid token in localStorage
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Ensure gender is present for compatibility
        if (!parsedUser.gender) parsedUser.gender = "male";
        setUser(parsedUser);
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      } catch (error) {
        console.error("Failed to restore user session:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: User, token: string) => {
    // Ensure gender is present for compatibility
    const userWithGender = { ...userData, gender: userData.gender || "male" };
    setUser(userWithGender);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userWithGender));
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common["Authorization"];
  };

  const handleProfileClick = () => {
    setShowProfile(true);
  };

  const handleProfileBack = () => {
    setShowProfile(false);
  };

  const handleProfileUpdate = (updatedUser: any) => {
    // Merge the updated user data with existing user data to ensure _id is preserved
    const mergedUser = {
      ...user,
      ...updatedUser,
      _id: updatedUser._id || user?._id,
      id: updatedUser._id || updatedUser.id || user?.id,
      gender: updatedUser.gender || user?.gender || "male",
    } as User;
    setUser(mergedUser);
    localStorage.setItem("user", JSON.stringify(mergedUser));
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route
            path="/admin-login"
            element={<AdminLogin onLogin={handleLogin} />}
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-code" element={<VerifyCode />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    );
  }

  return (
    <Router>
      <div className="app">
        {user.role === "admin" ? null : (
          <Topbar
            fullName={`${user.firstName} ${user.lastName}`}
            onLogout={handleLogout}
            onProfileClick={handleProfileClick}
            profilePhoto={user.profilePhoto}
          />
        )}
        <ChangePasswordModal
          isOpen={showChangePassword}
          onClose={() => setShowChangePassword(false)}
        />
        <main className="main-content">
          {user.role === "admin" ? (
            <AdminLayout
              fullName={`${user.firstName} ${user.lastName}`}
              onLogout={handleLogout}
              profilePhoto={user.profilePhoto}
              onSettingsClick={() => setShowAdminSettings(true)}
              onSettingsClose={() => setShowAdminSettings(false)}
              showAdminSettings={showAdminSettings}
              isSettingsActive={showAdminSettings}
            >
              {showAdminSettings ? (
                <AdminSettings
                  user={user}
                  onBack={() => setShowAdminSettings(false)}
                  onUpdate={handleProfileUpdate}
                />
              ) : (
                <Routes>
                  <Route
                    path="/"
                    element={
                      <AdminDashboard
                        fullName={`${user.firstName} ${user.lastName}`}
                        onLogout={handleLogout}
                        profilePhoto={user.profilePhoto}
                      />
                    }
                  />
                  <Route
                    path="/schedules"
                    element={<ScheduleManagement user={user} />}
                  />
                  <Route path="/reports" element={<Reports user={user} />} />
                  <Route
                    path="/users"
                    element={<UserManagement user={user} />}
                  />
                  <Route
                    path="/classrooms"
                    element={<ClassroomManagement user={user} />}
                  />
                  <Route
                    path="/instructors"
                    element={<InstructorManagement user={user} />}
                  />
                  <Route
                    path="/activity-logs"
                    element={<ActivityLogs user={user} />}
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </AdminLayout>
          ) : showProfile ? (
            <Profile
              user={user}
              onBack={handleProfileBack}
              onUpdate={handleProfileUpdate}
              onChangePassword={() => setShowChangePassword(true)}
            />
          ) : (
            <Routes>
              <Route
                path="/"
                element={<TimeTracker user={user} onLogout={handleLogout} />}
              />
              <Route
                path="/classrooms"
                element={<ClassroomManagement user={user} />}
              />
              <Route
                path="/schedules"
                element={<ScheduleManagement user={user} />}
              />
              <Route path="/usage" element={<ClassroomUsage user={user} />} />
              <Route path="/monitoring" element={<Monitoring user={user} />} />
              <Route path="/reports" element={<Reports user={user} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>
      </div>
    </Router>
  );
};

export default App;
