import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import * as authController from "../controllers/authController.js";
import {
  validateRequest,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  verifyCodeValidation,
  resetPasswordValidation,
  updateProfileValidation,
  changePasswordValidation,
} from "../middleware/authValidation.js";

const router = express.Router();
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

// POST /register
router.post(
  "/register",
  registerValidation,
  validateRequest,
  controllerHandler(authController.register)
);

// POST /login
router.post(
  "/login",
  loginValidation(RECAPTCHA_SECRET_KEY),
  validateRequest,
  controllerHandler(authController.login)
);

// POST /google
router.post(
  "/google",
  controllerHandler(authController.googleLogin)
);

// POST /forgot
router.post(
  "/forgot",
  forgotPasswordValidation,
  validateRequest,
  controllerHandler(authController.forgotPassword)
);

// POST /verify-code
router.post(
  "/verify-code",
  verifyCodeValidation,
  validateRequest,
  controllerHandler(authController.verifyCode)
);

// POST /reset
router.post(
  "/reset",
  resetPasswordValidation,
  validateRequest,
  controllerHandler(authController.resetPassword)
);

// GET /me
router.get(
  "/me",
  authenticateToken,
  controllerHandler(authController.getMe)
);

// PUT /profile
router.put(
  "/profile",
  authenticateToken,
  updateProfileValidation,
  validateRequest,
  controllerHandler(authController.updateProfile)
);

// POST /change-password
router.post(
  "/change-password",
  authenticateToken,
  changePasswordValidation,
  validateRequest,
  controllerHandler(authController.changePassword)
);

export default router;
