import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { logActivity } from "../middleware/activityLogger.js";
import * as userController from "../controllers/userController.js";
import * as profileController from "../controllers/profileController.js";

const router = express.Router();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for profile photo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../uploads/profiles");
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// @route   PUT /api/users/profile
// @desc    Update own profile (any authenticated user)
// @access  Private
// NOTE: This route MUST come before /:id routes to avoid matching "profile" as an ID
router.put("/profile", authenticateToken, upload.single('profilePhoto'), logActivity, profileController.updateProfile);

// @route   GET /api/users
// @desc    Get all users with pagination, search, filter, and sort (admin only)
// @access  Private/Admin
router.get("/", authenticateToken, requireAdmin, userController.getUsers);

// @route   POST /api/users
// @desc    Create new user (admin only)
// @access  Private/Admin
router.post("/", authenticateToken, requireAdmin, logActivity, userController.createUser);

// @route   GET /api/users/:id
// @desc    Get user by ID (admin only)
// @access  Private/Admin
router.get("/:id", authenticateToken, requireAdmin, userController.getUserById);

// @route   PUT /api/users/:id
// @desc    Update user (admin only)
// @access  Private/Admin
router.put("/:id", authenticateToken, requireAdmin, logActivity, userController.updateUser);

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete("/:id", authenticateToken, requireAdmin, logActivity, userController.deleteUser);

// @route   PUT /api/users/:id/reset-password
// @desc    Reset user password (admin only)
// @access  Private/Admin
router.put("/:id/reset-password", authenticateToken, requireAdmin, logActivity, userController.resetUserPassword);

export default router;

