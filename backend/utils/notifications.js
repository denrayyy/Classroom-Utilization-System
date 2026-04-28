import Notification from "../models/Notification.js";

export const createNotification = async (userId, title, message, link = "") => {
  return Notification.create({
    userId,
    title,
    message,
    type: "timein",
    link,
  });
};

export const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ userId, read: false });
};

export const getNotifications = async (userId, page = 1, limit = 10) => {
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Number.parseInt(limit, 10) || 10);

  const [items, total] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Notification.countDocuments({ userId }),
  ]);

  return {
    notifications: items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
    },
  };
};

export const markAsRead = async (notificationId, userId) => {
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true } },
    { new: true },
  ).lean();
};

export const markAllAsRead = async (userId) => {
  return Notification.updateMany(
    { userId, read: false },
    { $set: { read: true } },
  );
};
