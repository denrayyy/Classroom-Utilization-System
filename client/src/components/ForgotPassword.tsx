import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [userType, setUserType] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    // Get userType from location state to track which login type initiated forgot password
    const stateUserType = location.state?.userType as 'user' | 'admin';
    if (stateUserType) {
      setUserType(stateUserType);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/auth/forgot', { email });
      setSuccess(true);
      // Navigate to verify code page after a short delay, passing userType
      setTimeout(() => {
        navigate('/verify-code', { state: { email, userType } });
      }, 2000);
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to send verification code. Please try again.');
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

        <h2 className="login-heading">Forgot Password</h2>

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
            Verification code sent! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || success}
              placeholder="Enter your email address"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary figma-login-btn" 
            disabled={loading || success}
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </form>

        <div className="forgot-below">
          <Link className="forgot-link" to={userType === 'admin' ? '/admin-login' : '/login'}>Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

