import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Bell } from "lucide-react";
import "./NotificationBell.css";

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

const formatWhen = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<NotificationItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  const token = useMemo(() => localStorage.getItem("token"), []);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  const fetchUnreadCount = async () => {
    if (!token) return;
    try {
      const response = await axios.get("/api/notifications/unread-count", {
        headers: authHeaders,
      });
      setUnread(response.data?.unread || 0);
    } catch (error) {
      console.error("Failed to fetch unread notification count:", error);
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await axios.get("/api/notifications", {
        headers: authHeaders,
        params: { page: 1, limit: 20 },
      });
      setNotifications(response.data?.notifications || []);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (page = 1) => {
    if (!token) return;
    try {
      setHistoryLoading(true);
      const response = await axios.get("/api/notifications", {
        headers: authHeaders,
        params: { page, limit: 12 },
      });
      setHistoryItems(response.data?.notifications || []);
      setHistoryPage(response.data?.pagination?.page || 1);
      setHistoryTotalPages(response.data?.pagination?.pages || 1);
    } catch (error) {
      console.error("Failed to fetch notification history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleMarkOneRead = async (notificationId: string) => {
    if (!token) return;
    try {
      await axios.patch(
        `/api/notifications/${notificationId}/read`,
        {},
        { headers: authHeaders },
      );
      setNotifications((prev) =>
        prev.map((item) =>
          item._id === notificationId ? { ...item, read: true } : item,
        ),
      );
      setUnread((prev) => Math.max(0, prev - 1));
      setHistoryItems((prev) =>
        prev.map((item) =>
          item._id === notificationId ? { ...item, read: true } : item,
        ),
      );
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      await axios.patch(
        "/api/notifications/read-all",
        {},
        { headers: authHeaders },
      );
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      setHistoryItems((prev) => prev.map((item) => ({ ...item, read: true })));
      setUnread(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read) {
      await handleMarkOneRead(item._id);
    }
    if (item.link) {
      navigate(item.link);
      setOpen(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = window.setInterval(fetchUnreadCount, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  useEffect(() => {
    if (showHistoryModal) {
      fetchHistory(historyPage);
    }
  }, [showHistoryModal, historyPage]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="notif-bell-container" ref={containerRef}>
      <button
        type="button"
        className="notif-bell-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <h4>Notifications</h4>
            <button
              type="button"
              className="notif-mark-all"
              onClick={handleMarkAllRead}
              disabled={!notifications.some((item) => !item.read)}
            >
              Mark all read
            </button>
          </div>

          <div className="notif-list">
            {loading ? (
              <div className="notif-empty">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">No notifications yet.</div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className={`notif-item ${item.read ? "read" : "unread"}`}
                  onClick={() => handleNotificationClick(item)}
                >
                  <div className="notif-title-row">
                    <span className="notif-title">{item.title}</span>
                    {!item.read && <span className="notif-dot" />}
                  </div>
                  <p className="notif-message">{item.message}</p>
                  <span className="notif-time">{formatWhen(item.createdAt)}</span>
                </button>
              ))
            )}
          </div>
          <div className="notif-dropdown-footer">
            <button
              type="button"
              className="notif-view-all"
              onClick={() => {
                setHistoryPage(1);
                setShowHistoryModal(true);
                setOpen(false);
              }}
            >
              View all
            </button>
          </div>
        </div>
      )}

      {showHistoryModal && (
        <div
          className="notif-modal-overlay"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            className="notif-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="notif-modal-header">
              <h3>Notification History</h3>
              <button
                type="button"
                className="notif-modal-close"
                onClick={() => setShowHistoryModal(false)}
              >
                ×
              </button>
            </div>

            <div className="notif-modal-actions">
              <button
                type="button"
                className="notif-mark-all"
                onClick={handleMarkAllRead}
                disabled={!historyItems.some((item) => !item.read)}
              >
                Mark all read
              </button>
            </div>

            <div className="notif-modal-list">
              {historyLoading ? (
                <div className="notif-empty">Loading...</div>
              ) : historyItems.length === 0 ? (
                <div className="notif-empty">No notifications found.</div>
              ) : (
                historyItems.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    className={`notif-item ${item.read ? "read" : "unread"}`}
                    onClick={() => handleNotificationClick(item)}
                  >
                    <div className="notif-title-row">
                      <span className="notif-title">{item.title}</span>
                      {!item.read && <span className="notif-dot" />}
                    </div>
                    <p className="notif-message">{item.message}</p>
                    <span className="notif-time">{formatWhen(item.createdAt)}</span>
                  </button>
                ))
              )}
            </div>

            <div className="notif-pagination">
              <button
                type="button"
                className="notif-page-btn"
                disabled={historyPage <= 1 || historyLoading}
                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </button>
              <span>
                Page {historyPage} of {Math.max(1, historyTotalPages)}
              </span>
              <button
                type="button"
                className="notif-page-btn"
                disabled={historyPage >= historyTotalPages || historyLoading}
                onClick={() =>
                  setHistoryPage((prev) =>
                    Math.min(historyTotalPages || 1, prev + 1),
                  )
                }
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
