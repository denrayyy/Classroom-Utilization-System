import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { body, validationResult } from "express-validator";
import { authenticateToken } from "../middleware/auth.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
// Use same client ID as frontend (hardcoded fallback matches frontend)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '83745494475-om5dg3d440dhnh500ncrbpbkar7ev4s5.apps.googleusercontent.com';

// Helper: Verify Google reCAPTCHA v2/v3 token server-side
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

// Helper: Nodemailer transport for SMTP (forgot password)
function getMailTransport() {
  // Use provided email credentials or fallback to environment variables
  const user = process.env.EMAIL_USER || "2301101329@student.buksu.edu.ph";
  const pass = process.env.EMAIL_PASS || "tmzp dgnf egeh ummf";
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });
}

// Helper: Generate 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// @route   POST /api/auth/register
// @desc    Register a new instructor (admin accounts are pre-created)
// @access  Public
router.post("/register", [
  body("firstName").notEmpty().withMessage("First name is required"),
  body("lastName").notEmpty().withMessage("Last name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("employeeId").notEmpty().withMessage("Employee ID is required")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { firstName, lastName, email, password, employeeId, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { employeeId }] 
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
      employeeId,
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
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error during registration" });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
  body("recaptchaToken").custom((value) => {
    if (!RECAPTCHA_SECRET_KEY) return true; // skip validation when disabled
    if (!value) {
      throw new Error("reCAPTCHA token is required");
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// @route   POST /api/auth/google
// @desc    Google OAuth login (user). Client sends Google authorization code or ID token; server verifies and issues JWT.
// @access  Public
router.post("/google", async (req, res) => {
  try {
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
      // Get redirect URI from request body or use default
      // The client sends the redirect URI it used for the OAuth flow
      // This must match exactly what was used in the authorization request
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
    // User must be registered in the database first
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
  } catch (error) {
    console.error("Google OAuth login error:", error);
    // Provide more specific error messages
    if (error.message && error.message.includes('invalid_grant')) {
      return res.status(400).json({ 
        message: "Google authentication expired. Please try logging in again." 
      });
    }
    res.status(500).json({ 
      message: error.response?.data?.error_description || error.message || "Server error during Google login. Please try again." 
    });
  }
});

// @route   POST /api/auth/forgot
// @desc    Send password reset verification code via email (SMTP)
// @access  Public
router.post("/forgot", [ body("email").isEmail().withMessage("Valid email is required") ], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Server error during forgot password" });
  }
});

// @route   POST /api/auth/verify-code
// @desc    Verify the password reset code
// @access  Public
router.post("/verify-code", [
  body("email").isEmail().withMessage("Valid email is required"),
  body("code").notEmpty().withMessage("Verification code is required")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
  } catch (error) {
    console.error("Verify code error:", error);
    res.status(500).json({ message: "Server error during code verification" });
  }
});

// @route   POST /api/auth/reset
// @desc    Reset password using reset token (after code verification)
// @access  Public
router.post("/reset", [
  body("resetToken").notEmpty().withMessage("Reset token is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error during password reset" });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", authenticateToken, async (req, res) => {
  try {
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
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", authenticateToken, [
  body("firstName").optional().notEmpty().withMessage("First name cannot be empty"),
  body("lastName").optional().notEmpty().withMessage("Last name cannot be empty"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("phone").optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

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
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ message: "Server error during profile update" });
  }
});

export default router;
