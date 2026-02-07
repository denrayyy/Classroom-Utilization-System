/**
 * Profile Controller
 * Handles profile-related operations (own profile updates)
 */

import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { prepareActivityLog } from "../middleware/activityLogger.js";

/**
 * Update own profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, email } = req.body;

  // ✅ STEP 1: FETCH ORIGINAL USER (FOR EVIDENCE)
  const originalUser = await User.findById(req.user._id).lean();

  if (!originalUser) {
    return res.status(404).json({ message: "User not found" });
  }

  // Email uniqueness check
  if (email && email !== originalUser.email) {
    const existingUser = await User.findOne({
      _id: { $ne: req.user._id },
      email,
    });

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "A user with this email already exists" });
    }
  }

  // ✅ STEP 2: APPLY UPDATES
  const user = await User.findById(req.user._id);

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (email) user.email = email;

  if (req.file) {
    user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
  }

  await user.save();

  // ✅ STEP 3: BUILD EVIDENCE (OLD vs NEW)
  const changes = {};

  if (firstName && originalUser.firstName !== firstName) {
    changes.firstName = {
      old: originalUser.firstName,
      new: firstName,
    };
  }

  if (lastName && originalUser.lastName !== lastName) {
    changes.lastName = {
      old: originalUser.lastName,
      new: lastName,
    };
  }

  if (email && originalUser.email !== email) {
    changes.email = {
      old: originalUser.email,
      new: email,
    };
  }

  if (req.file && originalUser.profilePhoto !== user.profilePhoto) {
    changes.profilePhoto = {
      old: originalUser.profilePhoto || null,
      new: user.profilePhoto,
    };
  }

  // ✅ STEP 4: LOG ACTIVITY
  prepareActivityLog(
    req,
    "update",
    "User",
    user._id,
    `${user.firstName} ${user.lastName}`,
    Object.keys(changes).length ? changes : null
  );

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
