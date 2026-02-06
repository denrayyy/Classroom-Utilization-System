import ActivityLog from "../models/ActivityLog.js"; // make sure the path is correct

export const getActivityLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 }) // newest first
      .populate("user", "firstName lastName email"); // if user is a reference
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch activity logs" });
  }
};
