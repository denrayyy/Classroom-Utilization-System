import User from "../models/User.js";

const getEnv = (key, fallback) => process.env[key] && process.env[key].trim() !== "" ? process.env[key].trim() : fallback;

export default async function seedAdminIfMissing() {
  const adminPassword = getEnv("ADMIN_DEFAULT_PASSWORD", "admin");
  const secondAdminPassword = getEnv("ADMIN2_DEFAULT_PASSWORD", "admin");
  const teacherPassword = getEnv("TEACHER_DEFAULT_PASSWORD", "reden123");

  // Seed Admin
  const adminEmail = "clausysadmin@buksu.edu.ph";
  const existingAdmin = await User.findOne({ email: adminEmail });

  if (!existingAdmin) {
    // Create admin if missing
    const admin = new User({
      firstName: "System",
      lastName: "Administrator",
      email: adminEmail,
      password: adminPassword,
      employeeId: "ADMIN001",
      department: "Administration",
      role: "admin",
      phone: "",
      isActive: true
    });
    await admin.save();
    console.log("Seeded admin:", adminEmail);
  } else {
    // Always ensure known credentials & active status after imports
    existingAdmin.firstName = existingAdmin.firstName || "System";
    existingAdmin.lastName = existingAdmin.lastName || "Administrator";
    existingAdmin.password = adminPassword; // will be hashed by pre-save hook
    existingAdmin.role = "admin";
    existingAdmin.isActive = true;
    await existingAdmin.save();
    console.log("Reset admin password for:", adminEmail);
  }

  // Seed second admin
  const secondAdminEmail = "raydenivandelfin@gmail.com";
  const existingSecondAdmin = await User.findOne({ email: secondAdminEmail });

  if (!existingSecondAdmin) {
    const secondAdmin = new User({
      firstName: "System",
      lastName: "Administrator02",
      email: secondAdminEmail,
      password: secondAdminPassword,          // Will be hashed by pre-save hook
      employeeId: "ADMIN002",
      department: "Administration",
      role: "admin",
      phone: "",
      isActive: true,
    });

    await secondAdmin.save();
    console.log("Seeded second admin:", secondAdminEmail);
  } else {
    existingSecondAdmin.firstName = existingSecondAdmin.firstName || "System";
    existingSecondAdmin.lastName = existingSecondAdmin.lastName || "Administrator02";
    existingSecondAdmin.password = secondAdminPassword; // reset to known value
    existingSecondAdmin.role = "admin";
    existingSecondAdmin.isActive = true;
    await existingSecondAdmin.save();
    console.log("Reset admin password for:", secondAdminEmail);
  }


  // Seed Regular User (teacher) - per request
  const userEmail = "reden@gmail.com";
  const existingUser = await User.findOne({ email: userEmail });
  if (!existingUser) {
    const teacher = new User({
      firstName: "Reden",
      lastName: "User",
      email: userEmail,
      password: teacherPassword,
      // Don't set employeeId to avoid duplicate key errors
      department: "General",
      role: "teacher",
      isActive: true
    });
    await teacher.save();
    console.log("Seeded user:", userEmail);
  } else {
    // Keep teacher active and set a known password for debugging if needed
    existingUser.password = teacherPassword;
    existingUser.role = "teacher";
    existingUser.isActive = true;
    await existingUser.save();
    console.log("Reset teacher password for:", userEmail);
  }
}


