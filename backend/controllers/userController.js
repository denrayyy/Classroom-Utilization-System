/**
 * User Controller
 * Handles HTTP requests and responses for user operations
 */

import * as userService from "../services/userService.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { prepareActivityLog } from "../middleware/activityLogger.js";
import User from "../models/User.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError,
} from "../utils/mvcc.js";

/**
 * Get all users with pagination, search, filter, and sort
 */

export const getUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    role,
    department,
    isActive, // Frontend sends isActive
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build filter
  const filter = {};
  
  // Handle active/archived filtering
  if (isActive !== undefined) {
    filter.isActive = isActive === "true";
  } else {
    // Default to showing only active users
    filter.isActive = true;
  }

  // Add role filter if provided
  if (role) filter.role = role;
  
  // Add department filter if provided
  if (department) filter.department = department;

  // Build sort
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  // Get users from service - this ALREADY returns { users, pagination }
  const result = await userService.getUsers({
    page: parseInt(page),
    limit: parseInt(limit),
    search,
    filter,
    sort,
  });

//  Just return the result directly
  res.json(result);
});

/**
 *  ADD THIS RIGHT HERE - Get all unique departments for filter dropdown
 */
export const getDepartments = asyncHandler(async (req, res) => {
  const departments = await User.distinct("department", { 
    department: { $ne: null, $ne: "" } 
  });
  
  // Filter out null/empty values and sort alphabetically
  const validDepartments = departments
    .filter(dept => dept && dept.trim() !== "")
    .sort();
  
  res.json(validDepartments);
});

/**
 * Get user by ID
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json(user);
});

/**
 * Create new user
 */
export const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password, department, role, gender } = req.body;

  const user = await userService.createUser({
    firstName,
    lastName,
    email,
    password,
    department,
    role,
    gender,
  });

  // Log activity
  prepareActivityLog(req, "create", "User", user._id, `${user.firstName} ${user.lastName}`);

  res.status(201).json({
    message: "User created successfully",
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      department: user.department,
      gender: user.gender,
      isActive: user.isActive,
    },
  });
});

/**
 * Update user
 */
export const updateUser = asyncHandler(async (req, res) => {
  const version = requireVersion(req.body.version);
  const { firstName, lastName, email, department, role, isActive, gender } = req.body;

  // Check if email is being changed to one that already exists
  if (email !== undefined) {
    const existingUser = await userService.getUserById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (email !== existingUser.email) {
      const emailExists = await userService.getUsers({
        filter: { email },
        limit: 1,
      });
      if (emailExists.users.length > 0 && emailExists.users[0]._id.toString() !== req.params.id) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
    }
  }

  const updates = {};
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;
  if (email !== undefined) updates.email = email;
  if (department !== undefined) updates.department = department;
  if (role !== undefined) updates.role = role;
  if (isActive !== undefined) updates.isActive = isActive;
  if (gender !== undefined) updates.gender = gender;

  const updateDoc = buildVersionedUpdateDoc(updates);

  try {
    const updatedUser = await runVersionedUpdate(User, req.params.id, version, updateDoc, {
      select: "-password",
    });

    if (!updatedUser) {
      return respondWithConflict(res, "User");
    }

    let action = "update";

// If only `isActive` changed, determine archive/restore
if (updates.isActive !== undefined) {
  action = updates.isActive ? "restore" : "archive";
}


    // Log activity
    prepareActivityLog(
      req,
      action,
      "User",
      updatedUser._id,
      `${updatedUser.firstName} ${updatedUser.lastName}`,
      updates
    );

    res.json({
      message: "User updated successfully",
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department,
        gender: updatedUser.gender,
        isActive: updatedUser.isActive,
        version: updatedUser.version,
      },
    });
  } catch (error) {
    if (isVersionError(error)) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }
});

/**
 * Delete user
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Prevent admin from deleting themselves
  if (req.user._id.toString() === req.params.id) {
    return res.status(400).json({ message: "You cannot delete your own account" });
  }

  await userService.deleteUser(req.params.id);

  // Log activity
  prepareActivityLog(req, "delete", "User", user._id, `${user.firstName} ${user.lastName}`);

  res.json({ message: "User deleted successfully" });
});

/**
 * Reset user password
 */
export const resetUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;

  const user = await userService.resetUserPassword(req.params.id, newPassword);

  // Log activity
  prepareActivityLog(req, "update", "User", user._id, `${user.firstName} ${user.lastName}`, {
    field: "password",
    action: "reset",
  });

  res.json({
    message: "Password reset successfully",
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
  });
});

