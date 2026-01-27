import React from 'react';
import { Link } from 'react-router-dom';
import './Landing.css';

const Landing: React.FC = () => {
  return (
    <div className="landing-page">
      <div className="landing-center">
        <div className="landing-logo" aria-hidden>
          <svg viewBox="0 0 128 128" width="300" height="300" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M48 120h32" stroke="#cfd8dc" strokeWidth="6" strokeLinecap="round"/>
            <path d="M64 16c-18.2 0-33 14.8-33 33 0 11.7 6 22 15.1 28 2.9 1.9 5.9 6.3 5.9 12v3h24v-3c0-5.7 3-10.1 5.9-12 9.1-6 15.1-16.3 15.1-28 0-18.2-14.8-33-33-33z" stroke="#e0e6ea" strokeWidth="5"/>
            <path d="M52 96h24" stroke="#e0e6ea" strokeWidth="5" strokeLinecap="round"/>
            <path d="M81 35a24 24 0 0 0-34 34" stroke="#e0e6ea" strokeWidth="5" strokeLinecap="round"/>
            <path d="M88 90c8 0 16-9 16-22-10 1-18 9-16 22z" stroke="#39b07a" strokeWidth="5"/>
            <path d="M56 108h16" stroke="#00a6bb" strokeWidth="5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="landing-title">ClaUSys</div>
        <div className="landing-actions">
          <Link className="landing-btn" to="/login">Login</Link>
          <Link className="landing-btn" to="/admin-login">Login as Admin</Link>
        </div>
      </div>
    </div>
  );
};

export default Landing;


