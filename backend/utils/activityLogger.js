import ActivityLog from "../models/ActivityLog.js";

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  entityName,
  changes,
  req
}) {
  try {
    await ActivityLog.create({
      user: userId,
      action,
      entityType,
      entityId,
      entityName,
      changes,
      ipAddress: req?.ip,
      userAgent: req?.headers["user-agent"]
    });
  } catch (error) {
    console.error("Activity log error:", error.message);
  }
}
