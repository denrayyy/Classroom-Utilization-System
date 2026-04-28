import React, { useState, useEffect } from "react";
import axios from "axios";
import "./HolidayManagement.css";
import {
  Calendar,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  Download,
} from "lucide-react";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher";
  employeeId: string;
  department: string;
}

interface Holiday {
  _id: string;
  date: string;
  name: string;
  type: "regular" | "special" | "non-working";
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HolidayManagementProps {
  user: User;
}

const HolidayManagement: React.FC<HolidayManagementProps> = ({ user }) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState({
    date: "",
    name: "",
    type: "regular" as "regular" | "special" | "non-working",
    description: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState({
    year: new Date().getFullYear().toString(),
    active: "true",
  });

  useEffect(() => {
    fetchHolidays();
  }, [filter]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.year) params.append("year", filter.year);
      if (filter.active) params.append("active", filter.active);

      const token = localStorage.getItem("token");
      const response = await axios.get(`/api/holidays?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHolidays(response.data);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      setError("Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Seed Philippine holidays
  const handleSeedHolidays = async () => {
    const year = parseInt(filter.year);
    if (
      !window.confirm(
        `This will add Philippine holidays for ${year}. Continue?`,
      )
    ) {
      return;
    }

    try {
      setSeeding(true);
      setError("");
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "/api/holidays/seed",
        { year },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setSuccess(
        response.data.message || `Successfully seeded holidays for ${year}!`,
      );
      fetchHolidays();
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to seed holidays");
    } finally {
      setSeeding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.name.trim()) {
      setError("Date and name are required");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      if (editingHoliday) {
        await axios.put(
          `/api/holidays/${editingHoliday._id}`,
          formData,
          config,
        );
        setSuccess("Holiday updated successfully!");
      } else {
        await axios.post("/api/holidays", formData, config);
        setSuccess("Holiday created successfully!");
      }

      setShowForm(false);
      setEditingHoliday(null);
      setFormData({
        date: "",
        name: "",
        type: "regular",
        description: "",
      });
      fetchHolidays();
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to save holiday");
    }
  };

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      date: holiday.date.split("T")[0],
      name: holiday.name,
      type: holiday.type,
      description: holiday.description || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (holiday: Holiday) => {
    if (
      !window.confirm(`Are you sure you want to archive "${holiday.name}"?`)
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`/api/holidays/${holiday._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuccess(`"${holiday.name}" archived successfully!`);
      fetchHolidays();
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to delete holiday");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Calculate stats
  const activeCount = holidays.filter((h) => h.isActive).length;
  const archivedCount = holidays.filter((h) => !h.isActive).length;
  const regularCount = holidays.filter(
    (h) => h.type === "regular" && h.isActive,
  ).length;
  const specialCount = holidays.filter(
    (h) => h.type === "special" && h.isActive,
  ).length;

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading holidays...</p>
      </div>
    );
  }

  return (
    <div className="holiday-management">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>
            <Calendar
              size={28}
              color="#0ec0d4"
              style={{ marginRight: "10px" }}
            />
            Holiday Management
          </h1>
          <p>Manage holidays and non-working days</p>
        </div>
        <div className="header-stats">
          <div className="stat-chip">
            <span className="stat-label">Active</span>
            <span className="stat-value">{activeCount}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Regular</span>
            <span className="stat-value">{regularCount}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Special</span>
            <span className="stat-value">{specialCount}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Archived</span>
            <span className="stat-value">{archivedCount}</span>
          </div>
        </div>
      </div>

      {/* Success & Error Messages */}
      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters & Actions */}
      <div className="card">
        <div className="card-header">
          <h2>Holidays</h2>
          <div className="header-actions">
            <div className="filter-group">
              <label>Year:</label>
              <select
                value={filter.year}
                onChange={(e) => setFilter({ ...filter, year: e.target.value })}
                className="filter-select"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const year = new Date().getFullYear() + i - 2;
                  return (
                    <option key={year} value={year.toString()}>
                      {year}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="filter-group">
              <label>Status:</label>
              <select
                value={filter.active}
                onChange={(e) =>
                  setFilter({ ...filter, active: e.target.value })
                }
                className="filter-select"
              >
                <option value="true">Active Only</option>
                <option value="false">All (Including Archived)</option>
              </select>
            </div>

            {/* ✅ Seed Holidays Button */}
            <button
              className="btn btn-outline"
              onClick={handleSeedHolidays}
              disabled={seeding}
              title={`Seed Philippine holidays for ${filter.year}`}
            >
              <Download size={16} />
              {seeding ? "Seeding..." : `Seed ${filter.year} Holidays`}
            </button>

            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingHoliday(null);
                setFormData({
                  date: "",
                  name: "",
                  type: "regular",
                  description: "",
                });
                setShowForm(true);
              }}
            >
              <Plus size={16} />
              Add Holiday
            </button>
          </div>
        </div>

        {/* Holiday Form Modal */}
        {showForm && (
          <div className="modal-overlay" onClick={() => setShowForm(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  <Calendar size={20} color="#0ec0d4" />
                  {editingHoliday ? "Edit Holiday" : "Add Holiday"}
                </h2>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => {
                    setShowForm(false);
                    setEditingHoliday(null);
                    setFormData({
                      date: "",
                      name: "",
                      type: "regular",
                      description: "",
                    });
                    setError("");
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <form onSubmit={handleSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) =>
                          setFormData({ ...formData, date: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Holiday Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="e.g., Christmas Day"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            type: e.target.value as any,
                          })
                        }
                      >
                        <option value="regular">Regular Holiday</option>
                        <option value="special">Special Holiday</option>
                        <option value="non-working">Non-Working Day</option>
                      </select>
                    </div>

                    <div className="form-group full-width">
                      <label>Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        rows={3}
                        placeholder="Optional description..."
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowForm(false);
                        setEditingHoliday(null);
                        setFormData({
                          date: "",
                          name: "",
                          type: "regular",
                          description: "",
                        });
                        setError("");
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingHoliday ? "Update Holiday" : "Create Holiday"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Holidays Table */}
        <div className="holidays-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Type</th>
                <th>Description</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {holidays.length > 0 ? (
                holidays.map((holiday) => (
                  <tr
                    key={holiday._id}
                    className={!holiday.isActive ? "archived-row" : ""}
                  >
                    <td>{formatDate(holiday.date)}</td>
                    <td>
                      <strong>{holiday.name}</strong>
                    </td>
                    <td>
                      <span className={`type-badge ${holiday.type}`}>
                        {holiday.type.charAt(0).toUpperCase() +
                          holiday.type.slice(1)}
                      </span>
                    </td>
                    <td>{holiday.description || "-"}</td>
                    <td>
                      <span
                        className={`status-badge ${holiday.isActive ? "active" : "inactive"}`}
                      >
                        {holiday.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="action-cell">
                      <button
                        className="btn-icon-only"
                        onClick={() => handleEdit(holiday)}
                        title="Edit holiday"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn-icon-only danger"
                        onClick={() => handleDelete(holiday)}
                        title="Archive holiday"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="no-data">
                    <div className="empty-state">
                      <Calendar size={48} color="rgba(255,255,255,0.3)" />
                      <p>No holidays found for the selected filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HolidayManagement;
