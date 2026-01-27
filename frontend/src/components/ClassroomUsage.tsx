import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ClassroomUsage.css';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'student' | 'admin' | 'teacher'; // 'teacher' kept for backward compatibility
  employeeId: string;
  department: string;
}

interface ClassroomUsageProps {
  user: User;
}

const ClassroomUsage: React.FC<ClassroomUsageProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading classroom usage...</p>
      </div>
    );
  }

  return (
    <div className="classroom-usage">
      <div className="page-header">
        <h1>Classroom Usage</h1>
        <p>Track classroom utilization and check in/out</p>
      </div>

      <div className="card">
        <h2>Classroom Usage Tracking</h2>
        <p>This feature will allow teachers to check in and out of classrooms, track time, and record attendance.</p>
        <p>Features include:</p>
        <ul>
          <li>Time in/Time out functionality</li>
          <li>Classroom monitoring</li>
          <li>Remarks and signature capture</li>
          <li>Holiday and no-class indicators</li>
          <li>Asynchronous class monitoring</li>
          <li>Utilization rate calculation</li>
        </ul>
      </div>
    </div>
  );
};

export default ClassroomUsage;
