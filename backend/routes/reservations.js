import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import * as reservationController from "../controllers/reservationController.js";

const router = express.Router();


// GET /api/reservations - Get all reservations
router.get(
  "/",
  authenticateToken,
  controllerHandler(reservationController.getReservations)
);

// POST /api/reservations - Create a new reservation
router.post(
  "/",
  authenticateToken,
  controllerHandler(reservationController.createReservation)
);

// PUT /api/reservations/:id - Update a reservation
router.put(
  "/:id",
  authenticateToken,
  controllerHandler(reservationController.updateReservation)
);

// DELETE /api/reservations/:id - Delete a reservation
router.delete(
  "/:id",
  authenticateToken,
  controllerHandler(reservationController.deleteReservation)
);

export default router;

