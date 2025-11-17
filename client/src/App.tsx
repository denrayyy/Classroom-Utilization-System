import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

// Components
import Login from './components/Login';
import AdminLogin from './components/AdminLogin';
import Landing from './components/Landing';
import ForgotPassword from './components/ForgotPassword';
import VerifyCode from './components/VerifyCode';
import ResetPassword from './components/ResetPassword';
// removed Register and Dashboard (not used)
import TimeTracker from './components/TimeTracker';
import ClassroomManagement from './components/ClassroomManagement';
import UserManagement from './components/UserManagement';
import InstructorManagement from './components/InstructorManagement';
import ScheduleManagement from './components/ScheduleManagement';
import ClassroomUsage from './components/ClassroomUsage';
import Monitoring from './components/Monitoring';
import Reports from './components/Reports';
import AdminDashboard from './components/AdminDashboard';
import AdminLayout from './components/AdminLayout';
import Topbar from './components/Topbar';
import Profile from './components/Profile';

// Types
interface User {
  _id: string;
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'student' | 'admin' | 'teacher'; // 'teacher' kept for backward compatibility
  employeeId: string;
  department: string;
  phone?: string;
  profilePhoto?: string;
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    // Clear any previous session on app load
    // This ensures users always see the landing page when the app starts
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setLoading(false);
  }, []);

  const handleLogin = (userData: User, token: string) => {
    setUser(userData);
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const handleProfileClick = () => {
    setShowProfile(true);
  };

  const handleProfileBack = () => {
    setShowProfile(false);
  };

  const handleProfileUpdate = (updatedUser: any) => {
    // Merge the updated user data with existing user data to ensure _id is preserved
    setUser((prevUser) => ({
      ...prevUser,
      ...updatedUser,
      _id: updatedUser._id || prevUser?._id,
      id: updatedUser._id || updatedUser.id || prevUser?.id
    } as User));
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
          <Route path="/admin-login" element={<AdminLogin onLogin={handleLogin} />} />
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
        {user.role === 'admin' ? null : <Topbar fullName={`${user.firstName} ${user.lastName}`} onLogout={handleLogout} onProfileClick={handleProfileClick} profilePhoto={user.profilePhoto} />}
        <main className="main-content">
          {user.role === 'admin' ? (
            <AdminLayout fullName={`${user.firstName} ${user.lastName}`} onLogout={handleLogout} profilePhoto={user.profilePhoto}>
              <Routes>
                <Route path="/" element={<AdminDashboard fullName={`${user.firstName} ${user.lastName}`} onLogout={handleLogout} profilePhoto={user.profilePhoto} />} />
                <Route path="/schedules" element={<ScheduleManagement user={user} />} />
                <Route path="/reports" element={<Reports user={user} />} />
                <Route path="/users" element={<UserManagement user={user} defaultTab="users" />} />
                <Route path="/classrooms" element={<UserManagement user={user} defaultTab="classrooms" />} />
                <Route path="/instructors" element={<InstructorManagement user={user} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AdminLayout>
          ) : showProfile ? (
            <Profile user={user} onBack={handleProfileBack} onUpdate={handleProfileUpdate} />
          ) : (
            <Routes>
              <Route path="/" element={<TimeTracker user={user} onLogout={handleLogout} />} />
              <Route path="/classrooms" element={<ClassroomManagement user={user} />} />
              <Route path="/schedules" element={<ScheduleManagement user={user} />} />
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