import express from "express";
import ClassroomUsage from "../models/ClassroomUsage.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError
} from "../utils/mvcc.js";

const router = express.Router();

// GET /api/usage - Get classroom usage data
router.get("/", authenticateToken, async (req, res) => {
  try {
    const usage = await ClassroomUsage.find()
      .populate("classroom", "name location capacity")
      .populate("teacher", "firstName lastName email")
      .populate("schedule")
      .sort({ date: -1 });
    res.json(usage);
  } catch (error) {
    console.error("Get usage error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/usage - Create classroom usage record
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      classroom,
      teacher,
      schedule,
      date,
      timeIn,
      timeOut,
      status,
      utilizationRate,
      notes
    } = req.body;

    const usage = new ClassroomUsage({
      classroom,
      teacher,
      schedule,
      date,
      timeIn,
      timeOut,
      status: status || "on-time",
      utilizationRate,
      notes
    });

    await usage.save();
    await usage.populate([
      { path: "classroom", select: "name location capacity" },
      { path: "teacher", select: "firstName lastName email" },
      { path: "schedule" }
    ]);

    res.status(201).json({
      message: "Usage record created successfully",
      usage
    });
  } catch (error) {
    console.error("Create usage error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/usage/daily - Get daily usage statistics
router.get("/daily", authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    let query = {};

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    const usage = await ClassroomUsage.find(query)
      .populate("classroom", "name location capacity")
      .populate("teacher", "firstName lastName email")
      .sort({ date: -1 });

    res.json(usage);
  } catch (error) {
    console.error("Get daily usage error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/usage/:id - Get specific usage record
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const usage = await ClassroomUsage.findById(req.params.id)
      .populate("classroom", "name location capacity")
      .populate("teacher", "firstName lastName email")
      .populate("schedule");

    if (!usage) {
      return res.status(404).json({ message: "Usage record not found" });
    }

    res.json(usage);
  } catch (error) {
    console.error("Get usage error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/usage/:classroomId - Update usage record
router.put("/:classroomId", authenticateToken, async (req, res) => {
  try {
    const version = requireVersion(req.body.version);

    const {
      timeIn,
      timeOut,
      status,
      utilizationRate,
      notes
    } = req.body;

    const updates = {};
    if (timeIn !== undefined) updates.timeIn = timeIn;
    if (timeOut !== undefined) updates.timeOut = timeOut;
    if (status !== undefined) updates.status = status;
    if (utilizationRate !== undefined) updates.utilizationRate = utilizationRate;
    if (notes !== undefined) updates.notes = notes;

    const updateDoc = buildVersionedUpdateDoc(updates);

    const usage = await runVersionedUpdate(
      ClassroomUsage,
      req.params.classroomId,
      version,
      updateDoc
    );

    if (!usage) {
      return respondWithConflict(res, "Usage Record");
    }

    res.json({
      message: "Usage record updated successfully",
      usage
    });
  } catch (error) {
    console.error("Update usage error:", error);

    if (isVersionError(error)) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/usage/:classroomId - Delete usage record
router.delete("/:classroomId", authenticateToken, async (req, res) => {
  try {
    const usage = await ClassroomUsage.findByIdAndDelete(req.params.classroomId);

    if (!usage) {
      return res.status(404).json({ message: "Usage record not found" });
    }

    res.json({ message: "Usage record deleted successfully" });
  } catch (error) {
    console.error("Delete usage error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;