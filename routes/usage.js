import express from "express";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// GET /api/usage - Get classroom usage data
router.get("/", authenticateToken, (req, res) => {
  try {
    res.json({ message: "Classroom usage data", usage: [] });
  } catch (error) {
    console.error("Get usage error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/usage/daily - Get daily usage statistics
router.get("/daily", authenticateToken, (req, res) => {
  try {
    res.json({ message: "Daily usage statistics", data: [] });
  } catch (error) {
    console.error("Get daily usage error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/usage/:classroomId - Get usage for a specific classroom
router.get("/:classroomId", authenticateToken, (req, res) => {
  try {
    const { classroomId } = req.params;
    res.json({ message: `Usage for classroom ${classroomId}`, usage: [] });
  } catch (error) {
    console.error("Get classroom usage error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
