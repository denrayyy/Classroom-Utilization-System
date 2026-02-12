import ActivityLog from "../models/ActivityLog.js";

/**
 * Get activity logs with pagination, filtering, and search
 */
export const getActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      action,
      entityType,
      startDate,
      endDate,
    } = req.query;

    // Build filter query
    const filter = {};

    // Filter by action
    if (action && action !== "all") {
      filter.action = action;
    }

    // Filter by entity type
    if (entityType && entityType !== "all") {
      filter.entityType = entityType;
    }

    // Filter by date range
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateTime;
      }
    }

    // Search functionality
    if (search) {
      filter.$or = [
        { "user.firstName": { $regex: search, $options: "i" } },
        { "user.lastName": { $regex: search, $options: "i" } },
        { "user.email": { $regex: search, $options: "i" } },
        { entityName: { $regex: search, $options: "i" } },
        { entityType: { $regex: search, $options: "i" } },
      ];
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await ActivityLog.countDocuments(filter);

    // Get paginated logs
    const logs = await ActivityLog.find(filter)
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limitNum)
      .populate("user", "firstName lastName email role")
      .lean();

    // Calculate total pages
    const pages = Math.ceil(total / limitNum);

    res.json({
      logs,
      pagination: {
        total,
        pages,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (err) {
    console.error("Error fetching activity logs:", err);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
};

/**
 * Get all unique entity types for filter dropdown
 */
export const getEntityTypes = async (req, res) => {
  try {
    const entityTypes = await ActivityLog.distinct("entityType");
    res.json(entityTypes);
  } catch (err) {
    console.error("Error fetching entity types:", err);
    res.status(500).json({ message: "Failed to fetch entity types" });
  }
};

/**
 * Get a single activity log by ID
 */
export const getActivityLogById = async (req, res) => {
  try {
    const log = await ActivityLog.findById(req.params.id)
      .populate("user", "firstName lastName email role")
      .lean();

    if (!log) {
      return res.status(404).json({ message: "Activity log not found" });
    }

    res.json(log);
  } catch (err) {
    console.error("Error fetching activity log:", err);
    res.status(500).json({ message: "Failed to fetch activity log" });
  }
};

/**
 * Create a new activity log (usually called from other controllers)
 */
export const createActivityLog = async (logData) => {
  try {
    const log = new ActivityLog(logData);
    await log.save();
    return log;
  } catch (err) {
    console.error("Error creating activity log:", err);
    throw err;
  }
};

/**
 * Delete old activity logs (for cleanup jobs)
 */
export const deleteOldLogs = async (daysOld = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await ActivityLog.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    return result;
  } catch (err) {
    console.error("Error deleting old logs:", err);
    throw err;
  }
};