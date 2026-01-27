import React, { useState, useEffect } from "react";
import axios from "axios";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "admin" | "teacher";
  employeeId: string;
  department: string;
}

interface Classroom {
  _id: string;
  name: string;
  capacity: number;
  location: string;
  equipment: string[];
  isAvailable: boolean;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface ClassroomManagementProps {
  user: User;
}

const ClassroomManagement: React.FC<ClassroomManagementProps> = ({ user }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(
    null,
  );
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    description: "",
    isAvailable: true,
  });
  const [error, setError] = useState("");
  const [versionConflict, setVersionConflict] = useState(false);
  const [roomFilter, setRoomFilter] = useState<"all" | "comlab" | "non-comlab">("all");

  useEffect(() => {
    fetchClassrooms();
  }, []);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/classrooms");
      setClassrooms(response.data);
    } catch (error) {
      console.error("Error fetching classrooms:", error);
      setError("Failed to fetch classrooms");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setVersionConflict(false);

    try {
      if (editingClassroom) {
        const updatePayload = {
          ...formData,
          version: editingClassroom.version,
        };
        await axios.put(
          `/api/classrooms/${editingClassroom._id}`,
          updatePayload,
        );
      } else {
        await axios.post("/api/classrooms", formData);
      }

      setShowForm(false);
      setEditingClassroom(null);
      setFormData({
        name: "",
        location: "",
        description: "",
        isAvailable: true,
      });
      fetchClassrooms();
    } catch (error: any) {
      const statusCode = error.response?.status;
      const responseData = error.response?.data;

      if (statusCode === 409) {
        const conflictMessage =
          responseData?.message ||
          "Another admin updated this classroom. Refresh and try again.";
        setVersionConflict(true);
        setError("⚠️ CONFLICT DETECTED:\n\n" + conflictMessage);
        alert("⚠️ CONFLICT DETECTED:\n\n" + conflictMessage);
        return;
      }

      setError(
        error.response?.data?.message ||
          error.response?.data?.msg ||
          "Failed to save classroom",
      );
    }
  };

  const handleEdit = (classroom: Classroom) => {
    setEditingClassroom(classroom);
    setFormData({
      name: classroom.name,
      location: classroom.location,
      description: classroom.description || "",
      isAvailable: classroom.isAvailable,
    });
    setShowForm(true);
  };

  const handleDelete = async (classroom: Classroom) => {
    if (window.confirm("Are you sure you want to delete this classroom?")) {
      try {
        await axios.delete(`/api/classrooms/${classroom._id}`);
        fetchClassrooms();
      } catch (error: any) {
        setError(
          error.response?.data?.message ||
            error.response?.data?.msg ||
            "Failed to delete classroom",
        );
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingClassroom(null);
    setFormData({
      name: "",
      location: "",
      description: "",
      isAvailable: true,
    });
    setError("");
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading classrooms...</p>
      </div>
    );
  }

  const isComlab = (room: Classroom) =>
    /comlab/i.test(room.name) || /comlab/i.test(room.location);
  const filteredClassrooms =
    roomFilter === "all"
      ? classrooms
      : roomFilter === "comlab"
        ? classrooms.filter(isComlab)
        : classrooms.filter((room) => !isComlab(room));

  return (
    <div className="classroom-management">
      <div className="page-header">
        <h1>Classroom Management</h1>
        <p>Manage classroom information and availability</p>
      </div>

      {/* Room type filter */}
      <div
        style={{
          margin: "1rem 0",
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontWeight: 500,
            fontSize: "1.1rem",
          }}
        >
          <span style={{ whiteSpace: "nowrap" }}>Room type:</span>
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value as "all" | "comlab" | "non-comlab")}
            style={{
              padding: "0.4rem 0.6rem",
              fontSize: "1.1rem",
              borderRadius: "6px",
              border: "1px solid #ccc",
              minWidth: "140px",
            }}
          >
            <option value="all">All</option>
            <option value="comlab">ComLab</option>
            <option value="non-comlab">Non-ComLab</option>
          </select>
        </label>
      </div>

      {error && <div className="error-message">{error}</div>}

      {versionConflict && (
        <div className="conflict-message">
          <p>
            <strong>Data was updated elsewhere:</strong> The classroom data has
            been modified by another user. Please click "Refresh" to reload the
            latest data and try your changes again.
          </p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              fetchClassrooms();
              handleCancel();
            }}
          >
            Refresh
          </button>
        </div>
      )}

      <div className="card">
        <div
          className="card-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0 }}>Classrooms</h2>
          {!showForm && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingClassroom(null);
                setFormData({
                  name: "",
                  location: "",
                  description: "",
                  isAvailable: true,
                });
                setShowForm(true);
              }}
            >
              Add Classroom
            </button>
          )}
        </div>

        {/* Classroom Card Grid */}
        <div
          className="classroom-card-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem",
          }}
        >
          {filteredClassrooms.map((classroom) => (
            <div
              key={classroom._id}
              className="classroom-card"
              style={{
                background: "#fff",
                borderRadius: "10px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <h3 style={{ margin: 0 }}>{classroom.name}</h3>
              <div>
                <strong>Location:</strong> {classroom.location}
              </div>
              {classroom.description && (
                <div>
                  <strong>Description:</strong> {classroom.description}
                </div>
              )}
              <div
                style={{ marginTop: "auto", display: "flex", gap: "0.5rem" }}
              >
                <button
                  className="btn btn-primary"
                  onClick={() => alert("View not implemented")}
                >
                  View
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => handleEdit(classroom)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-warning"
                  onClick={() => handleDelete(classroom)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {filteredClassrooms.length === 0 && (
            <div
              style={{
                gridColumn: "1/-1",
                textAlign: "center",
                color: "#888",
                padding: "2rem",
              }}
            >
              No classrooms found.
            </div>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="classroom-form">
            <h3>{editingClassroom ? "Edit Classroom" : "Add New Classroom"}</h3>
            <div className="form-group">
              <label htmlFor="name">Classroom Name</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) =>
                    setFormData({ ...formData, isAvailable: e.target.checked })
                  }
                />
                Available for booking
              </label>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingClassroom ? "Update" : "Create"} Classroom
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ClassroomManagement;
