import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { controllerHandler } from "../middleware/controllerHandler.js";
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from "../utils/notifications.js";

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  controllerHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const payload = await getNotifications(req.user._id, page, limit);
    res.json(payload);
  }),
);

router.get(
  "/unread-count",
  authenticateToken,
  controllerHandler(async (req, res) => {
    const unread = await getUnreadCount(req.user._id);
    res.json({ unread });
  }),
);

router.patch(
  "/:id/read",
  authenticateToken,
  controllerHandler(async (req, res) => {
    const notification = await markAsRead(req.params.id, req.user._id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ message: "Notification marked as read", notification });
  }),
);

router.patch(
  "/read-all",
  authenticateToken,
  controllerHandler(async (req, res) => {
    const result = await markAllAsRead(req.user._id);
    res.json({
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount || 0,
    });
  }),
);

export default router;
