import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ClassroomManagement.css";

interface Instructor {
  _id: string;
  name: string;
  version?: number;
  archived?: boolean;
  unavailable?: boolean;
  unavailableReason?: string;
}

interface InstructorManagementProps {
  user: { id: string };
}

const InstructorManagement: React.FC<InstructorManagementProps> = ({
  user,
}) => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [archivedInstructors, setArchivedInstructors] = useState<Instructor[]>(
    []
  );
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [showArchivedList, setShowArchivedList] = useState(false);
  const [newInstructorName, setNewInstructorName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "archive" | "restore" | "unavailable";
    id: string;
    name: string;
    version?: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingVersion, setEditingVersion] = useState<number | undefined>();
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [unavailableModalData, setUnavailableModalData] = useState<{
    id: string;
    name: string;
    version?: number;
    reason: string;
  }>({ id: "", name: "", version: undefined, reason: "" });

  useEffect(() => {
    fetchInstructors();
  }, []);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/instructors");
      const allInstructors = response.data;
      setInstructors(
        allInstructors.filter((inst: Instructor) => !inst.archived)
      );
      setArchivedInstructors(
        allInstructors.filter((inst: Instructor) => inst.archived)
      );
    } catch (error: any) {
      setError("Failed to fetch instructors");
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!newInstructorName.trim()) {
      setError("Instructor name is required");
      return;
    }

    try {
      await axios.post("/api/instructors", { name: newInstructorName.trim() });
      setNewInstructorName("");
      setShowInstructorForm(false);
      fetchInstructors();
      setSuccess("Instructor added successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to add instructor");
    }
  };

  const handleArchiveInstructor = async (
    id: string,
    name: string,
    version?: number
  ) => {
    setConfirmAction({ type: "archive", id, name, version });
    setShowConfirmModal(true);
  };

  const handleRestoreInstructor = async (
    id: string,
    name: string,
    version?: number
  ) => {
    setConfirmAction({ type: "restore", id, name, version });
    setShowConfirmModal(true);
  };

  const handleEditInstructor = (
    id: string,
    currentName: string,
    version?: number
  ) => {
    setEditingId(id);
    setEditingName(currentName);
    setEditingVersion(version);
  };

  const handleSaveName = async (id: string) => {
    if (!editingName.trim()) {
      setError("Instructor name is required");
      return;
    }

    try {
      const payload: any = {
        name: editingName.trim(),
      };

      // Only include version if it exists
      if (editingVersion !== undefined) {
        payload.version = editingVersion;
      }

      await axios.put(`/api/instructors/${id}`, payload);
      fetchInstructors();
      setSuccess("Instructor name updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
      setEditingId(null);
      setEditingName("");
      setEditingVersion(undefined);
    } catch (error: any) {
      if (error.response?.status === 409) {
        setError(
          "This instructor was updated by someone else. Please refresh and try again."
        );
      } else {
        setError(
          error.response?.data?.message || "Failed to update instructor name"
        );
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleUnavailableClick = (
    id: string,
    name: string,
    currentReason: string,
    version?: number
  ) => {
    setUnavailableModalData({ id, name, version, reason: currentReason || "" });
    setShowUnavailableModal(true);
  };

  const handleSaveUnavailable = async () => {
    try {
      const isUnavailable = unavailableModalData.reason.trim().length > 0;
      const payload: any = {
        unavailable: isUnavailable,
        unavailableReason: isUnavailable
          ? unavailableModalData.reason.trim()
          : null,
      };

      // Only include version if it exists
      if (unavailableModalData.version !== undefined) {
        payload.version = unavailableModalData.version;
      }

      await axios.put(`/api/instructors/${unavailableModalData.id}`, payload);
      fetchInstructors();
      setSuccess(
        `Instructor ${
          isUnavailable ? "marked as unavailable" : "marked as available"
        } successfully!`
      );
      setTimeout(() => setSuccess(""), 3000);
      setShowUnavailableModal(false);
      setUnavailableModalData({
        id: "",
        name: "",
        version: undefined,
        reason: "",
      });
    } catch (error: any) {
      if (error.response?.status === 409) {
        setError(
          "This instructor was updated by someone else. Please refresh and try again."
        );
      } else {
        setError(
          error.response?.data?.message ||
            "Failed to update instructor availability"
        );
      }
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;

    try {
      const archived = confirmAction.type === "archive";
      const payload: any = {
        archived,
      };

      // Include version for optimistic locking if available
      if (confirmAction.version !== undefined) {
        payload.version = confirmAction.version;
      }

      const response = await axios.put(
        `/api/instructors/${confirmAction.id}`,
        payload
      );
      console.log(`${confirmAction.type} response:`, response.data);
      fetchInstructors();
      setSuccess(
        `Instructor ${
          confirmAction.type === "archive" ? "archived" : "restored"
        } successfully!`
      );
      setTimeout(() => setSuccess(""), 3000);
      setShowConfirmModal(false);
      setConfirmAction(null);
    } catch (error: any) {
      console.error(
        `${confirmAction.type} error:`,
        error.response?.data || error.message
      );
      if (error.response?.status === 409) {
        setError(
          "This instructor was updated by someone else. Please refresh and try again."
        );
      } else {
        setError(
          error.response?.data?.message ||
            `Failed to ${confirmAction.type} instructor`
        );
      }
      setShowConfirmModal(false);
      setConfirmAction(null);
    }
  };

  const filteredInstructors = instructors.filter((instructor) =>
    instructor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredArchivedInstructors = archivedInstructors.filter((instructor) =>
    instructor.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="classroom-management">
      <div className="page-header">
        <h1>Manage Instructors</h1>
        <p>Add, view, and archive instructor names for time-in forms</p>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>Instructors</h2>
          <div className="header-buttons">
            {!showArchivedList && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setNewInstructorName("");
                  setError("");
                  setShowInstructorForm(true);
                }}
              >
                Add Instructor
              </button>
            )}
          </div>
        </div>

        {!showArchivedList && (
          <>
            <div
              style={{
                marginBottom: "20px",
                display: "flex",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="Search instructor by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  flex: 1,
                  maxWidth: "300px",
                }}
              />
              <button
                className="btn btn-secondary"
                onClick={() => setShowArchivedList(true)}
              >
                View Archived ({archivedInstructors.length})
              </button>
            </div>
            <div className="users-table">
              {filteredInstructors.length === 0 ? (
                <div className="no-classrooms">
                  <p>
                    {searchQuery
                      ? `No instructors found matching "${searchQuery}".`
                      : "No instructors found. Add your first instructor to get started."}
                  </p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Instructor Name</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstructors.map((instructor) => (
                      <tr key={instructor._id}>
                        <td>
                          {editingId === instructor._id ? (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "4px",
                                  border: "1px solid #ddd",
                                  fontSize: "14px",
                                  flex: 1,
                                }}
                              />
                              <button
                                onClick={() => handleSaveName(instructor._id)}
                                style={{
                                  padding: "6px 12px",
                                  backgroundColor: "#4caf50",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                style={{
                                  padding: "6px 12px",
                                  backgroundColor: "#f44336",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "4px",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div>
                              {instructor.name}
                              {instructor.unavailable && (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#ff9800",
                                    marginTop: "4px",
                                    fontStyle: "italic",
                                  }}
                                >
                                  ⚠️ Unavailable: {instructor.unavailableReason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td
                          className="action-buttons"
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          {editingId !== instructor._id && (
                            <>
                              <button
                                className="btn btn-info btn-sm"
                                onClick={() =>
                                  handleEditInstructor(
                                    instructor._id,
                                    instructor.name,
                                    instructor.version
                                  )
                                }
                                title="Edit instructor name"
                              >
                                Edit
                              </button>
                              <button
                                className={`btn btn-sm ${
                                  instructor.unavailable
                                    ? "btn-warning"
                                    : "btn-success"
                                }`}
                                onClick={() =>
                                  handleUnavailableClick(
                                    instructor._id,
                                    instructor.name,
                                    instructor.unavailableReason || "",
                                    instructor.version
                                  )
                                }
                                title={
                                  instructor.unavailable
                                    ? "Mark as available"
                                    : "Mark as unavailable"
                                }
                              >
                                {instructor.unavailable
                                  ? "Unavailable"
                                  : "Available"}
                              </button>
                              <button
                                className="btn btn-warning btn-sm"
                                onClick={() =>
                                  handleArchiveInstructor(
                                    instructor._id,
                                    instructor.name,
                                    instructor.version
                                  )
                                }
                                title="Archive instructor"
                              >
                                Archive
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {showArchivedList && (
          <>
            <div
              style={{
                marginBottom: "20px",
                display: "flex",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="Search archived instructor by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  flex: 1,
                  maxWidth: "300px",
                }}
              />
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowArchivedList(false);
                  setSearchQuery("");
                }}
              >
                Back to Active Instructors
              </button>
            </div>
            <div className="users-table">
              {filteredArchivedInstructors.length === 0 ? (
                <div className="no-classrooms">
                  <p>
                    {searchQuery
                      ? `No archived instructors found matching "${searchQuery}".`
                      : "No archived instructors found."}
                  </p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Instructor Name</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArchivedInstructors.map((instructor) => (
                      <tr key={instructor._id}>
                        <td>{instructor.name}</td>
                        <td className="action-buttons">
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() =>
                              handleRestoreInstructor(
                                instructor._id,
                                instructor.name,
                                instructor.version
                              )
                            }
                            title="Restore instructor"
                          >
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Instructor Modal */}
      {showInstructorForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              maxWidth: "500px",
              width: "90%",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "20px", color: "#333" }}>
              Add New Instructor
            </h3>
            <form onSubmit={handleAddInstructor}>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#333",
                    fontWeight: "500",
                  }}
                >
                  Instructor Name:
                </label>
                <input
                  type="text"
                  value={newInstructorName}
                  onChange={(e) => setNewInstructorName(e.target.value)}
                  placeholder="Enter instructor name"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowInstructorForm(false);
                    setNewInstructorName("");
                    setError("");
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                    backgroundColor: "#f5f5f5",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: "#007bff",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Add Instructor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              maxWidth: "400px",
              width: "90%",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "15px", color: "#333" }}>
              {confirmAction.type === "archive"
                ? "Archive Instructor"
                : "Restore Instructor"}
            </h3>
            <p style={{ color: "#666", marginBottom: "20px" }}>
              Are you sure you want to {confirmAction.type}{" "}
              <strong>{confirmAction.name}</strong>?
            </p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  backgroundColor: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmAction}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor:
                    confirmAction.type === "archive" ? "#ff9800" : "#4caf50",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {confirmAction.type === "archive" ? "Archive" : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unavailable Modal */}
      {showUnavailableModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              maxWidth: "500px",
              width: "90%",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "15px", color: "#333" }}>
              Instructor Availability
            </h3>
            <p style={{ color: "#666", marginBottom: "15px" }}>
              <strong>{unavailableModalData.name}</strong>
            </p>
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#333",
                  fontWeight: "500",
                }}
              >
                Reason (leave empty to mark as available):
              </label>
              <textarea
                value={unavailableModalData.reason}
                onChange={(e) =>
                  setUnavailableModalData({
                    ...unavailableModalData,
                    reason: e.target.value,
                  })
                }
                placeholder="e.g., On leave, Illness, Special event..."
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
                rows={4}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => {
                  setShowUnavailableModal(false);
                  setUnavailableModalData({ id: "", name: "", reason: "" });
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  backgroundColor: "#f5f5f5",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUnavailable}
                style={{
                  padding: "8px 16px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: unavailableModalData.reason.trim()
                    ? "#ff9800"
                    : "#4caf50",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {unavailableModalData.reason.trim()
                  ? "Mark Unavailable"
                  : "Mark Available"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorManagement;
