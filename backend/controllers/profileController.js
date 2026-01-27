/**
 * Profile Controller
 * Handles profile-related operations (own profile updates)
 */

import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";

/**
 * Update own profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Check if email is being changed to one that already exists
  if (email && email !== user.email) {
    const existingUser = await User.findOne({
      _id: { $ne: req.user._id },
      email,
    });

    if (existingUser) {
      return res.status(400).json({ message: "A user with this email already exists" });
    }
  }

  // Update user fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (email) user.email = email;

  // Update profile photo if uploaded
  if (req.file) {
    user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
  }

  await user.save();

  res.json({
    message: "Profile updated successfully",
    user: {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      department: user.department,
      phone: user.phone,
      profilePhoto: user.profilePhoto,
    },
  });
});

