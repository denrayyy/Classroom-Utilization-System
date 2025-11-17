import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 5
  },
  role: {
    type: String,
    enum: ["student", "admin", "teacher"], // "teacher" kept for backward compatibility during migration
    default: "student"
  },
  employeeId: {
    type: String,
    required: false,
    unique: true,
    sparse: true // Allows multiple null/undefined values while maintaining uniqueness for non-null values
  },
  department: {
    type: String,
    default: "General"
  },
  phone: {
    type: String
  },
  profilePhoto: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
  ,
  // Password reset support
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  // Verification code for password reset
  verificationCode: {
    type: String
  },
  verificationCodeExpires: {
    type: Date
  },
  // Optional Google account linkage (for OAuth sign-in)
  googleId: {
    type: String
  },
  version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual("fullName").get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
userSchema.set("toJSON", {
  virtuals: true
});

const User = mongoose.model("User", userSchema);

export default User;
