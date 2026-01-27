import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Monitoring.css';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'student' | 'admin' | 'teacher'; // 'teacher' kept for backward compatibility
  employeeId: string;
  department: string;
}

interface MonitoringProps {
  user: User;
}

const Monitoring: React.FC<MonitoringProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading monitoring data...</p>
      </div>
    );
  }

  return (
    <div className="monitoring">
      <div className="page-header">
        <h1>System Monitoring</h1>
        <p>Monitor classroom utilization and system performance</p>
      </div>

      <div className="card">
        <h2>Monitoring Dashboard</h2>
        <p>This feature will provide administrators with real-time monitoring capabilities.</p>
        <p>Features include:</p>
        <ul>
          <li>Daily classroom usage monitoring</li>
          <li>Schedule conflict detection and resolution</li>
          <li>Underutilized classroom identification</li>
          <li>Real-time utilization statistics</li>
          <li>System performance metrics</li>
          <li>Automated alerts and notifications</li>
        </ul>
      </div>
    </div>
  );
};

export default Monitoring;
