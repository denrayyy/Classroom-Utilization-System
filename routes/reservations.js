import express from "express";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// GET /api/reservations - Get all reservations
router.get("/", authenticateToken, (req, res) => {
  try {
    res.json({ message: "Reservations endpoint", reservations: [] });
  } catch (error) {
    console.error("Get reservations error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/reservations - Create a new reservation
router.post("/", authenticateToken, (req, res) => {
  try {
    res.status(201).json({ message: "Reservation created successfully" });
  } catch (error) {
    console.error("Create reservation error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/reservations/:id - Update a reservation
router.put("/:id", authenticateToken, (req, res) => {
  try {
    res.json({ message: "Reservation updated successfully" });
  } catch (error) {
    console.error("Update reservation error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/reservations/:id - Delete a reservation
router.delete("/:id", authenticateToken, (req, res) => {
  try {
    res.json({ message: "Reservation deleted successfully" });
  } catch (error) {
    console.error("Delete reservation error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
