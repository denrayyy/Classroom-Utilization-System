import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import {
  createHoliday,
  getHolidays,
  checkHoliday,
  updateHoliday,
  deleteHoliday,
  checkTodayHoliday,  // ✅ ADD THIS IMPORT
  seedHolidays,        // ✅ ADD THIS IMPORT
} from "../controllers/holidayController.js";

const router = express.Router();

// GET /api/holidays — get all holidays with optional filters
router.get("/", controllerHandler(getHolidays));

// ✅ GET /api/holidays/check-today — check if today is a holiday
router.get("/check-today", authenticateToken, controllerHandler(checkTodayHoliday));

// GET /api/holidays/check/:date — check if specific date is holiday
router.get("/check/:date", controllerHandler(checkHoliday));

// POST /api/holidays — create new holiday (admin only)
router.post("/", authenticateToken, requireAdmin, controllerHandler(createHoliday));

// ✅ POST /api/holidays/seed — seed Philippine holidays (admin only)
router.post("/seed", authenticateToken, requireAdmin, controllerHandler(seedHolidays));

// PUT /api/holidays/:id — update holiday (admin only)
router.put("/:id", authenticateToken, requireAdmin, controllerHandler(updateHoliday));

// DELETE /api/holidays/:id — archive holiday (admin only)
router.delete("/:id", authenticateToken, requireAdmin, controllerHandler(deleteHoliday));

export default router;