import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import SafeReCAPTCHA from "./SafeReCAPTCHA";
import "./Auth.css";

interface AdminLoginProps {
  onLogin: (user: any, token: string) => void;
}

const GOOGLE_CLIENT_ID =
  process.env.REACT_APP_GOOGLE_CLIENT_ID ||
  "83745494475-om5dg3d440dhnh500ncrbpbkar7ev4s5.apps.googleusercontent.com";

const AdminLoginContent: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const recaptchaSiteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY || "";

  // Only show Google client ID error if it's actually missing and user tries to use Google login
  const googleClientIdConfigured =
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (recaptchaSiteKey && !recaptchaToken) {
      setError("Please complete the reCAPTCHA challenge.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("/api/auth/login", {
        ...formData,
        recaptchaToken: recaptchaToken || undefined,
      });
      const { user, token } = response.data;
      if (user.role !== "admin") {
        setError("Admin access only.");
        return;
      }
      onLogin(user, token);
      if (recaptchaSiteKey) {
        setRecaptchaToken(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setGoogleLoading(true);
      setError("");
      try {
        // Exchange authorization code for ID token via backend
        // Send the redirect URI that was used (current origin for client-side OAuth)
        const googleResponse = await axios.post("/api/auth/google", {
          code: codeResponse.code,
          redirectUri: window.location.origin,
        });

        if (googleResponse.data.user?.role !== "admin") {
          setError(
            "Admin access only. Please use the Admin Login page for admin accounts.",
          );
          setGoogleLoading(false);
          return;
        }

        onLogin(googleResponse.data.user, googleResponse.data.token);
      } catch (error: any) {
        const errorMessage =
          error.response?.data?.message ||
          "Google login failed. Please try again.";
        setError(errorMessage);
        console.error("Google login error:", error);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (error) => {
      console.error("Google OAuth error:", error);
      setError(
        "Failed to connect to Google. Please check your internet connection and try again.",
      );
      setGoogleLoading(false);
    },
    flow: "auth-code",
  });

  const handleGoogleLoginClick = () => {
    if (!googleClientIdConfigured) {
      setError(
        "Google login is not configured. Please use email and password to login.",
      );
      return;
    }
    setError(""); // Clear any previous errors
    handleGoogleLogin();
  };

  return (
    <div className="auth-container figma-login-bg">
      <div className="auth-card figma-login-card">
        <div className="auth-brand">
          <div className="brand-text">
            <div className="brand-title">
              <span className="brand-strong">ClaUSys</span>
            </div>
            <div className="brand-subtitle">Classroom Utilization System</div>
          </div>
        </div>

        <h2 className="login-heading">Admin Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          {recaptchaSiteKey && (
            <div className="form-group">
              <SafeReCAPTCHA
                sitekey={recaptchaSiteKey}
                onChange={(token: string | null) => setRecaptchaToken(token)}
                onExpired={() => setRecaptchaToken(null)}
                fallbackMessage="reCAPTCHA is taking longer than expected. Please refresh and try again."
                onBoundaryError={(err) => {
                  console.error("Admin login reCAPTCHA error:", err);
                  setError(
                    "reCAPTCHA failed to load. Please refresh the page and try again.",
                  );
                }}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary figma-login-btn"
            disabled={loading || googleLoading}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
          <div className="forgot-below">
            <Link className="forgot-link" to="/">
              {" "}
              Landing Page
            </Link>
            <span style={{ margin: "0 8px", color: "#666" }}>|</span>
            <Link
              className="forgot-link"
              to="/forgot-password"
              state={{ userType: "admin" }}
            >
              Forgot Password?
            </Link>
          </div>
        </form>

        <div className="google-login-section">
          <div className="divider">
            <span>OR</span>
          </div>
          <button
            type="button"
            onClick={handleGoogleLoginClick}
            className="btn btn-google"
            disabled={loading || googleLoading || !googleClientIdConfigured}
          >
            {googleLoading ? (
              "Signing in with Google..."
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  style={{ marginRight: "8px" }}
                >
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957C.348 6.174 0 7.55 0 9s.348 2.826.957 4.044l3.007-2.332z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.956L3.964 7.288C4.672 5.163 6.656 3.58 9 3.58z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminLogin: React.FC<AdminLoginProps> = (props) => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AdminLoginContent {...props} />
    </GoogleOAuthProvider>
  );
};

export default AdminLogin;
