import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

const VerifyCode: React.FC = () => {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userType, setUserType] = useState<'user' | 'admin'>('user');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Get email and userType from location state
    const stateEmail = location.state?.email;
    const stateUserType = location.state?.userType as 'user' | 'admin';
    if (stateEmail) {
      setEmail(stateEmail);
      if (stateUserType) {
        setUserType(stateUserType);
      }
    } else {
      // If no email in state, redirect back to forgot password
      navigate('/forgot-password');
    }
  }, [location, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!code || code.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/auth/verify-code', { 
        email, 
        code: code.trim() 
      });
      
      // Navigate to reset password page with reset token and userType
      navigate('/reset-password', { 
        state: { 
          email,
          userType,
          resetToken: response.data.resetToken 
        } 
      });
    } catch (error: any) {
      setError(error.response?.data?.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
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

        <h2 className="login-heading">Verify Code</h2>
        <p style={{ textAlign: 'center', color: '#666', fontSize: '14px', marginBottom: '20px' }}>
          Enter the 6-digit verification code sent to {email}
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="code">Verification Code</label>
            <input
              type="text"
              id="code"
              name="code"
              value={code}
              onChange={handleCodeChange}
              required
              disabled={loading}
              placeholder="000000"
              maxLength={6}
              style={{
                textAlign: 'center',
                fontSize: '24px',
                letterSpacing: '8px',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary figma-login-btn" 
            disabled={loading || code.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>

        <div className="forgot-below">
          <Link className="forgot-link" to="/forgot-password">Resend Code</Link>
          <span style={{ margin: '0 8px', color: '#666' }}>|</span>
          <Link className="forgot-link" to="/">Back to Login</Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyCode;

