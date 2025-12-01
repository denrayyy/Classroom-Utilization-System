import express from "express";
import Schedule from "../models/Schedule.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  requireVersion,
  buildVersionedUpdateDoc,
  runVersionedUpdate,
  respondWithConflict,
  isVersionError
} from "../utils/mvcc.js";

const router = express.Router();

// GET /api/schedules - Get all schedules
router.get("/", authenticateToken, async (req, res) => {
  try {
    const schedules = await Schedule.find()
      .populate("teacher", "firstName lastName email")
      .populate("classroom", "name location")
      .sort({ createdAt: -1 });
    res.json(schedules);
  } catch (error) {
    console.error("Get schedules error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/schedules - Create a new schedule
router.post("/", authenticateToken, async (req, res) => {
  try {
    const {
      teacher,
      classroom,
      subject,
      courseCode,
      dayOfWeek,
      startTime,
      endTime,
      status,
      semester,
      academicYear,
      notes
    } = req.body;

    const schedule = new Schedule({
      teacher,
      classroom,
      subject,
      courseCode,
      dayOfWeek,
      startTime,
      endTime,
      status: status || "pending",
      semester,
      academicYear,
      notes
    });

    await schedule.save();
    await schedule.populate("teacher", "firstName lastName email");
    await schedule.populate("classroom", "name location");

    res.status(201).json({ 
      message: "Schedule created successfully",
      schedule 
    });
  } catch (error) {
    console.error("Create schedule error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/schedules/:id - Get a specific schedule
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate("teacher", "firstName lastName email")
      .populate("classroom", "name location");
    
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    res.json(schedule);
  } catch (error) {
    console.error("Get schedule error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/schedules/:id - Update a schedule
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const version = requireVersion(req.body.version);

    const {
      teacher,
      classroom,
      subject,
      courseCode,
      dayOfWeek,
      startTime,
      endTime,
      status,
      semester,
      academicYear,
      notes
    } = req.body;

    const updates = {};
    if (teacher !== undefined) updates.teacher = teacher;
    if (classroom !== undefined) updates.classroom = classroom;
    if (subject !== undefined) updates.subject = subject;
    if (courseCode !== undefined) updates.courseCode = courseCode;
    if (dayOfWeek !== undefined) updates.dayOfWeek = dayOfWeek;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (status !== undefined) updates.status = status;
    if (semester !== undefined) updates.semester = semester;
    if (academicYear !== undefined) updates.academicYear = academicYear;
    if (notes !== undefined) updates.notes = notes;

    const updateDoc = buildVersionedUpdateDoc(updates);

    const schedule = await runVersionedUpdate(
      Schedule,
      req.params.id,
      version,
      updateDoc
    );

    if (!schedule) {
      return respondWithConflict(res, "Schedule");
    }

    await schedule.populate("teacher", "firstName lastName email");
    await schedule.populate("classroom", "name location");

    res.json({ 
      message: "Schedule updated successfully",
      schedule 
    });
  } catch (error) {
    console.error("Update schedule error:", error);

    if (isVersionError(error)) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/schedules/:id - Delete a schedule
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndDelete(req.params.id);

    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    res.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Delete schedule error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
