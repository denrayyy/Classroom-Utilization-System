import mongoose from "mongoose";

/**
 * Activity Log Schema
 * 
 * Tracks all create, update, and delete operations
 * for audit and accountability purposes
 */
const activityLogSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["create", "update", "delete"],
      required: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        "User",
        "Schedule",
        "Classroom",
        "ClassroomUsage",
        "Report",
        "TimeIn",
        "Instructor",
      ],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    entityName: {
      type: String,
      required: true,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ entityType: 1, entityId: 1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;

