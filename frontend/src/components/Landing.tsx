import React from "react";
import { Link } from "react-router-dom";
import "./Landing.css";
import { ArrowRight, Clock, Users, Building } from "lucide-react";

const Landing: React.FC = () => {
  return (
    <div className="landing-page">
      <div className="landing-center">
        {/* Logo Section */}
        <div className="landing-logo-wrapper">
          <div className="landing-logo" aria-hidden>
            <svg
              viewBox="0 0 128 128"
              width="80"
              height="80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M48 120h32"
                stroke="#0ec0d4"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M64 16c-18.2 0-33 14.8-33 33 0 11.7 6 22 15.1 28 2.9 1.9 5.9 6.3 5.9 12v3h24v-3c0-5.7 3-10.1 5.9-12 9.1-6 15.1-16.3 15.1-28 0-18.2-14.8-33-33-33z"
                stroke="#0ec0d4"
                strokeWidth="5"
              />
              <path
                d="M52 96h24"
                stroke="#0ec0d4"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M81 35a24 24 0 0 0-34 34"
                stroke="#0ec0d4"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M88 90c8 0 16-9 16-22-10 1-18 9-16 22z"
                stroke="#27ae60"
                strokeWidth="5"
              />
              <path
                d="M56 108h16"
                stroke="#0ec0d4"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="landing-brand">
            <div className="landing-brand-title">ClaUSys</div>
            <div className="landing-brand-subtitle">
              Classroom Utilization System
            </div>
          </div>
        </div>

        {/* Main Title */}
        <h1 className="landing-title">
          Smart Classroom
          <span className="landing-highlight">Management System</span>
        </h1>

        {/* Description */}
        <p className="landing-description">
          Streamline classroom scheduling, track real-time utilization, and
          manage time-ins efficiently with our comprehensive solution.
        </p>

        {/* Action Buttons */}
        <div className="landing-actions">
          <Link className="landing-btn landing-btn-primary" to="/login">
            Student
          </Link>
          <Link className="landing-btn landing-btn-secondary" to="/admin-login">
            Administrator Access
          </Link>
        </div>

        {/* Features */}
        <div className="landing-features">
          <div className="feature-item">
            <div className="feature-icon">
              <Clock size={16} />
            </div>
            <span className="feature-text">Real-time Time-In</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">
              <Building size={16} />
            </div>
            <span className="feature-text">Classroom Management</span>
          </div>
          <div className="feature-item">
            <div className="feature-icon">
              <Users size={16} />
            </div>
            <span className="feature-text">Instructor Tracking</span>
          </div>
        </div>

        {/* Footer */}
        <div className="landing-footer">
          © 2026 ClaUSys. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Landing;
