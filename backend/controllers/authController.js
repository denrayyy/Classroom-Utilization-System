/**
 * Auth Controller
 * Handles HTTP requests and responses for authentication operations
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import config from "../config/config.js";

const JWT_SECRET = process.env.JWT_SECRET || config.JWT_SECRET;
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '83745494475-om5dg3d440dhnh500ncrbpbkar7ev4s5.apps.googleusercontent.com';

/**
 * Helper: Verify Google reCAPTCHA v2/v3 token server-side
 */
async function verifyRecaptchaToken(token, remoteip) {
  try {
    // If no secret key is configured, treat reCAPTCHA as disabled
    if (!RECAPTCHA_SECRET_KEY) return true;
    const params = new URLSearchParams();
    params.append("secret", RECAPTCHA_SECRET_KEY);
    params.append("response", token);
    if (remoteip) params.append("remoteip", remoteip);

    const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    const data = await resp.json();
    return !!data.success;
  } catch (e) {
    console.error("reCAPTCHA verify error:", e);
    return false;
  }
}

/**
 * Helper: Nodemailer transport for SMTP (forgot password)
 */
function getMailTransport() {
  const user = process.env.EMAIL_USER || "2301101329@student.buksu.edu.ph";
  const pass = process.env.EMAIL_PASS || "tmzp dgnf egeh ummf";
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });
}

/**
 * Helper: Generate 6-digit verification code
 */
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Register a new user (student only)
 */
export const register = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, employeeId, phone } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ 
    $or: [{ email }, ...(employeeId ? [{ employeeId }] : [])]
  });

  if (existingUser) {
    return res.status(400).json({ 
      message: "User with this email or employee ID already exists" 
    });
  }

  // Only allow student registration
  const user = new User({
    firstName,
    lastName,
    email,
    password,
    ...(employeeId && { employeeId }),
    department: "General", // Default department
    role: "student", // Force role to be student
    phone
  });

  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.status(201).json({
    message: "Student account created successfully",
    token,
    user: {
      _id: user._id,
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      department: user.department,
      phone: user.phone,
      profilePhoto: user.profilePhoto
    }
  });
});

/**
 * Login user
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password, recaptchaToken } = req.body;

  // Verify reCAPTCHA for both User and Admin logins (when enabled)
  const recaptchaOk = await verifyRecaptchaToken(recaptchaToken, req.ip);
  if (!recaptchaOk) {
    return res.status(400).json({ message: "reCAPTCHA verification failed" });
  }

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  // Check if user is active
  if (!user.isActive) {
    return res.status(400).json({ message: "Account is deactivated" });
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    message: "Login successful",
    token,
    user: {
      _id: user._id,
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      department: user.department,
      phone: user.phone,
      profilePhoto: user.profilePhoto
    }
  });
});

/**
 * Google OAuth login
 */
export const googleLogin = asyncHandler(async (req, res) => {
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!GOOGLE_CLIENT_SECRET) {
    console.error("GOOGLE_CLIENT_SECRET not configured in environment variables");
    return res.status(500).json({ 
      message: "Google OAuth is not properly configured. Please contact the administrator." 
    });
  }

  const client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  const { code, idToken } = req.body;

  let payload;
  let email;
  let sub;

  // Handle authorization code flow
  if (code) {
    const redirectUri = req.body.redirectUri || process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000';
    
    try {
      const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
      if (!tokens.id_token) {
        console.error("Failed to get ID token from Google OAuth");
        return res.status(400).json({ message: "Failed to authenticate with Google. Please try again." });
      }
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
      email = payload?.email;
      sub = payload?.sub;
    } catch (tokenError) {
      console.error("Google token exchange error:", tokenError);
      console.error("Error details:", {
        message: tokenError.message,
        code: tokenError.code,
        redirectUri: redirectUri
      });
      
      // Check for specific error types and provide helpful messages
      const errorMessage = tokenError.message || '';
      if (errorMessage.includes('redirect_uri_mismatch')) {
        return res.status(400).json({ 
          message: `Google OAuth configuration error: The redirect URI "${redirectUri}" does not match what's configured in Google Cloud Console. Please ensure "${redirectUri}" is added to Authorized redirect URIs.` 
        });
      }
      if (errorMessage.includes('invalid_grant')) {
        return res.status(400).json({ 
          message: "Google authentication code expired or invalid. Please try logging in again." 
        });
      }
      if (errorMessage.includes('invalid_client')) {
        return res.status(500).json({ 
          message: "Google OAuth client configuration error. Please check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are correct." 
        });
      }
      return res.status(400).json({ 
        message: `Failed to authenticate with Google: ${errorMessage || 'Please try again.'}` 
      });
    }
  } 
  // Handle direct ID token flow (backward compatibility)
  else if (idToken) {
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
      email = payload?.email;
      sub = payload?.sub;
    } catch (verifyError) {
      console.error("Google ID token verification error:", verifyError);
      return res.status(400).json({ 
        message: "Invalid Google authentication token. Please try again." 
      });
    }
  } else {
    return res.status(400).json({ message: "Either code or idToken is required" });
  }

  if (!email) {
    return res.status(400).json({ message: "Google token missing email" });
  }

  // Only allow sign-in for existing users by email (no auto-register)
  let user = await User.findOne({ email });
  if (!user) {
    return res.status(403).json({ 
      message: "This email is not registered. Please contact your administrator to create an account or use email/password login if you have an account." 
    });
  }

  // Check if user is active
  if (!user.isActive) {
    return res.status(400).json({ message: "Account is deactivated" });
  }

  // Optionally store googleId if not set
  if (!user.googleId && sub) {
    user.googleId = sub;
    await user.save();
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
  return res.json({
    message: "Google login successful",
    token,
    user: {
      _id: user._id,
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      department: user.department,
      phone: user.phone,
      profilePhoto: user.profilePhoto
    }
  });
});

/**
 * Send password reset verification code via email
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    // Avoid user enumeration: respond success regardless
    return res.json({ message: "If the email exists, a verification code has been sent." });
  }

  // Generate 6-digit verification code
  const verificationCode = generateVerificationCode();
  user.verificationCode = verificationCode;
  user.verificationCodeExpires = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes
  await user.save();

  const transporter = getMailTransport();
  if (!transporter) {
    return res.status(500).json({ message: "SMTP not configured" });
  }

  const emailUser = process.env.EMAIL_USER || "2301101329@student.buksu.edu.ph";
  
  await transporter.sendMail({
    from: emailUser,
    to: email,
    subject: "Password Reset Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0b5161;">Password Reset Request</h2>
        <p>You requested to reset your password for your ClaUSys account.</p>
        <p>Your verification code is:</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
          <h1 style="color: #0b5161; margin: 0; font-size: 32px; letter-spacing: 5px;">${verificationCode}</h1>
        </div>
        <p>This code will expire in 15 minutes.</p>
        <p>If you did not request this password reset, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">This is an automated message from ClaUSys - Classroom Utilization System</p>
      </div>
    `
  });

  return res.json({ message: "If the email exists, a verification code has been sent." });
});

/**
 * Verify the password reset code
 */
export const verifyCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ message: "Invalid email or verification code" });
  }

  if (user.verificationCode !== code) {
    return res.status(400).json({ message: "Invalid verification code" });
  }

  if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
    return res.status(400).json({ message: "Verification code has expired" });
  }

  // Code is valid - generate a temporary token for password reset
  const resetToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetToken = resetToken;
  user.passwordResetExpires = new Date(Date.now() + 1000 * 60 * 10); // 10 minutes
  // Clear verification code after successful verification
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save();

  return res.json({ 
    message: "Verification code is valid",
    resetToken: resetToken
  });
});

/**
 * Reset password using reset token
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password } = req.body;
  const user = await User.findOne({
    passwordResetToken: resetToken,
    passwordResetExpires: { $gt: new Date() }
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired reset token" });
  }

  user.password = password; // will be hashed by pre-save hook
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return res.json({ message: "Password has been reset successfully" });
});

/**
 * Get current user
 */
export const getMe = asyncHandler(async (req, res) => {
  res.json({
    user: {
      _id: req.user._id,
      id: req.user._id,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      role: req.user.role,
      employeeId: req.user.employeeId,
      department: req.user.department,
      phone: req.user.phone,
      profilePhoto: req.user.profilePhoto,
      lastLogin: req.user.lastLogin
    }
  });
});

/**
 * Update user profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone } = req.body;
  const updateData = {};

  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (email) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  ).select("-password");

  res.json({
    message: "Profile updated successfully",
    user
  });
});

/**
 * Change password for authenticated user
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  // Check if new password is same as current
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: "New password must be different from current password" });
  }

  // Update password
  user.password = newPassword; // Will be hashed by pre-save hook
  await user.save();

  res.json({ message: "Password changed successfully" });
});
