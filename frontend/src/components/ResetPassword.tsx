import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [userType, setUserType] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    // Get reset token and userType from location state
    const stateToken = location.state?.resetToken;
    const stateUserType = location.state?.userType as 'user' | 'admin';
    if (stateToken) {
      setResetToken(stateToken);
      if (stateUserType) {
        setUserType(stateUserType);
      }
    } else {
      // If no token in state, redirect back to forgot password
      navigate('/forgot-password');
    }
  }, [location, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!resetToken) {
      setError('Invalid reset token. Please start over.');
      return;
    }

    setLoading(true);

    try {
      await axios.post('/api/auth/reset', { 
        resetToken,
        password 
      });
      
      setSuccess(true);
      // Redirect to correct login page after 2 seconds
      setTimeout(() => {
        navigate(userType === 'admin' ? '/admin-login' : '/login');
      }, 2000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container figma-login-bg">
      <div className="auth-card figma-login-card">
        <div className="auth-brand">
          <div className="brand-text">
            <div className="brand-title"><span className="brand-strong">ClaUSys</span></div>
            <div className="brand-subtitle">Classroom Utilization System</div>
          </div>
        </div>

        <h2 className="login-heading">Reset Password</h2>

        {error && <div className="error-message">{error}</div>}
        {success && (
          <div style={{
            backgroundColor: '#d1fae5',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #a7f3d0',
            fontSize: '14px'
          }}>
            Password reset successfully! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || success}
              placeholder="Enter new password (min. 6 characters)"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading || success}
              placeholder="Confirm new password"
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary figma-login-btn" 
            disabled={loading || success}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="forgot-below">
          <Link className="forgot-link" to="/login">Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

