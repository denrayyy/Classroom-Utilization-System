/**
 * Activity Logging Middleware
 * Logs all create, update, and delete operations
 */

import ActivityLog from "../models/ActivityLog.js";

/**
 * Log activity middleware
 * Should be called after successful CUD operations
 */
export const logActivity = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to intercept response
  res.json = function (data) {
    // Only log if request was successful (2xx status)
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const activityData = req.activityLog;
      if (activityData) {

        // Log asynchronously without blocking response
        ActivityLog.create({
          user: req.user._id,
          action: activityData.action,
          entityType: activityData.entityType,
          entityId: activityData.entityId,
          entityName: activityData.entityName,
          changes: activityData.changes,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("user-agent"),
        }).catch((err) => {
          console.error("Failed to log activity:", err);
        });
      }
    }
    return originalJson(data);
  };

  next();
};

/**
 * Helper function to prepare activity log data
 * Call this in controllers before the operation
 */
export const prepareActivityLog = (req, action, entityType, entityId, entityName, changes = null) => {
  req.activityLog = {
    action,
    entityType,
    entityId,
    entityName,
    changes,
  };
};

