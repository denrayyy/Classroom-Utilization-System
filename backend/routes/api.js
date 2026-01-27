// server/routes/api.js
// Purpose: Example Express routes for the Classroom Utilization System (MERN).
// - POST /api/attendance: Log class attendance (teacher, classroom, time, status)
// - GET  /api/classrooms:  Fetch classroom status (e.g., which rooms are occupied)

import express from 'express';
import * as apiController from '../controllers/apiController.js';

const router = express.Router();

// POST /api/attendance
// Logs class attendance for a user/teacher in a given classroom at a specific time.
router.post('/attendance', apiController.logAttendance);

// GET /api/classrooms
// Returns current classroom statuses. Supports filtering via query parameters.
router.get('/classrooms', apiController.getClassroomStatus);

export default router;


