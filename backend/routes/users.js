import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { logActivity } from "../middleware/activityLogger.js";
import { uploadProfilePhoto } from "../middleware/userUpload.js";
import { controllerHandler } from "../middleware/controllerHandler.js";

import * as userController from "../controllers/userController.js";
import * as profileController from "../controllers/profileController.js";

const router = express.Router();

// @route   PUT /api/users/profile
// @desc    Update own profile
// @access  Private
router.put(
  "/profile",
  authenticateToken,
  uploadProfilePhoto,
  logActivity,
  controllerHandler(profileController.updateProfile)
);

// @route   GET /api/users
// @desc    Get all users
// @access  Private/Admin
router.get(
  "/",
  authenticateToken,
  requireAdmin,
  controllerHandler(userController.getUsers)
);

// @route   POST /api/users
// @desc    Create user
// @access  Private/Admin
router.post(
  "/",
  authenticateToken,
  requireAdmin,
  logActivity,
  controllerHandler(userController.createUser)
);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private/Admin
router.get(
  "/:id",
  authenticateToken,
  requireAdmin,
  controllerHandler(userController.getUserById)
);

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private/Admin
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  logActivity,
  controllerHandler(userController.updateUser)
);

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  logActivity,
  controllerHandler(userController.deleteUser)
);

// @route   PUT /api/users/:id/reset-password
// @desc    Reset user password
// @access  Private/Admin
router.put(
  "/:id/reset-password",
  authenticateToken,
  requireAdmin,
  logActivity,
  controllerHandler(userController.resetUserPassword)
);

export default router;
