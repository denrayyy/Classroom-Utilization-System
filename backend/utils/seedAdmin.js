import User from "../models/User.js";

// Helper to get environment variable or fallback
const getEnv = (key, fallback) =>
  process.env[key] && process.env[key].trim() !== "" ? process.env[key].trim() : fallback;

// General function to create or update a user
async function createOrUpdateUser({ email, firstName, lastName, passwordEnvKey, role, employeeId = "", department = "General", phone = "" }) {
  const password = getEnv(passwordEnvKey, "changeme123");
  const existingUser = await User.findOne({ email });

  if (!existingUser) {
    const newUser = new User({
      firstName,
      lastName,
      email,
      password, // Will be hashed by pre-save hook
      employeeId,
      department,
      role,
      phone,
      isActive: true,
    });
    await newUser.save();
    console.log(`Seeded ${role}:`, email);
  } else {
    // Update existing user
    existingUser.firstName = existingUser.firstName || firstName;
    existingUser.lastName = existingUser.lastName || lastName;
    existingUser.password = password; // Reset to env password
    existingUser.role = role;
    existingUser.isActive = true;
    await existingUser.save();
    console.log(`Reset ${role} password for:`, email);
  }
}

export default async function seedAdminIfMissing() {
  // Admin accounts
  await createOrUpdateUser({
    email: "clausysadmin@buksu.edu.ph",
    firstName: "System",
    lastName: "Administrator",
    passwordEnvKey: "ADMIN_DEFAULT_PASSWORD",
    role: "admin",
    employeeId: "ADMIN001",
    department: "Administration",
  });

  await createOrUpdateUser({
    email: "raydenivandelfin@gmail.com",
    firstName: "System",
    lastName: "Administrator02",
    passwordEnvKey: "ADMIN2_DEFAULT_PASSWORD",
    role: "admin",
    employeeId: "ADMIN002",
    department: "Administration",
  });

  // Teacher account
  await createOrUpdateUser({
    email: "reden@gmail.com",
    firstName: "Reden",
    lastName: "User",
    passwordEnvKey: "TEACHER_DEFAULT_PASSWORD",
    role: "teacher",
  });
}
