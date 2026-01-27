import express from "express";
import { body, validationResult } from "express-validator";
import { authenticateToken } from "../middleware/auth.js";
import * as authController from "../controllers/authController.js";

const router = express.Router();

// Validation middleware helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

// @route   POST /api/auth/register
// @desc    Register a new instructor (admin accounts are pre-created)
// @access  Public
router.post("/register", [
  body("firstName").notEmpty().withMessage("First name is required"),
  body("lastName").notEmpty().withMessage("Last name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("employeeId").optional().notEmpty().withMessage("Employee ID cannot be empty if provided")
], validate, authController.register);

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
], validate, authController.login);

// @route   POST /api/auth/google
// @desc    Google OAuth login (user). Client sends Google authorization code or ID token; server verifies and issues JWT.
// @access  Public
router.post("/google", authController.googleLogin);

// @route   POST /api/auth/forgot
// @desc    Send password reset verification code via email (SMTP)
// @access  Public
router.post("/forgot", [
  body("email").isEmail().withMessage("Valid email is required")
], validate, authController.forgotPassword);

// @route   POST /api/auth/verify-code
// @desc    Verify the password reset code
// @access  Public
router.post("/verify-code", [
  body("email").isEmail().withMessage("Valid email is required"),
  body("code").notEmpty().withMessage("Verification code is required")
], validate, authController.verifyCode);

// @route   POST /api/auth/reset
// @desc    Reset password using reset token (after code verification)
// @access  Public
router.post("/reset", [
  body("resetToken").notEmpty().withMessage("Reset token is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters")
], validate, authController.resetPassword);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get("/me", authenticateToken, authController.getMe);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", authenticateToken, [
  body("firstName").optional().notEmpty().withMessage("First name cannot be empty"),
  body("lastName").optional().notEmpty().withMessage("Last name cannot be empty"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("phone").optional().isString()
], validate, authController.updateProfile);

// @route   POST /api/auth/change-password
// @desc    Change password for authenticated user
// @access  Private
router.post("/change-password", authenticateToken, [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters")
], validate, authController.changePassword);

export default router;

