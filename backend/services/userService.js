/**
 * User Service
 * Reusable business logic for user operations
 */

import User from "../models/User.js";

/**
 * Get all users with pagination, search, filter, and sort
 */
export const getUsers = async (options = {}) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    filter = {},
    sort = { createdAt: -1 },
  } = options;

  const skip = (page - 1) * limit;

  // Build search query
  const searchQuery = search
    ? {
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { employeeId: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  // Combine filters
  const query = { ...searchQuery, ...filter };

  // Get total count for pagination
  const total = await User.countDocuments(query);

  // Get users
  const users = await User.find(query)
    .select("-password")
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  return {
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get user by ID
 */
export const getUserById = async (userId) => {
  return await User.findById(userId).select("-password");
};

/**
 * Create new user
 */
export const createUser = async (userData) => {
  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email: userData.email }, ...(userData.employeeId ? [{ employeeId: userData.employeeId }] : [])],
  });

  if (existingUser) {
    throw new Error("User with this email or employee ID already exists");
  }

  const user = new User({
    ...userData,
    password: userData.password || "DefaultPassword123",
    department: userData.department || "General",
    role: userData.role || "student",
    gender: userData.gender || "male",
    isActive: true,
  });

  await user.save();
  return user;
};

/**
 * Update user
 */
export const updateUser = async (userId, updateData) => {
  // Check if email is being changed to one that already exists
  if (updateData.email) {
    const existingUser = await User.findOne({
      _id: { $ne: userId },
      email: updateData.email,
    });

    if (existingUser) {
      throw new Error("A user with this email already exists");
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select("-password");

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

/**
 * Delete user
 */
export const deleteUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  await User.deleteOne({ _id: userId });
  return user;
};

/**
 * Reset user password
 */
export const resetUserPassword = async (userId, newPassword) => {
  if (!newPassword || newPassword.length < 5) {
    throw new Error("Password must be at least 5 characters long");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.password = newPassword;
  await user.save();

  return user;
};

