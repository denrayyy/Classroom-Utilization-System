import React, { useState, useEffect } from "react";
import axios from "axios";
import "./InstructorManagement.css"; // Create separate CSS file

interface Instructor {
  _id: string;
  name: string;
  version?: number;
  archived?: boolean;
  unavailable?: boolean;
  unavailableReason?: string;
  createdAt?: string;
}

interface InstructorManagementProps {
  user: { id: string };
}

const InstructorManagement: React.FC<InstructorManagementProps> = ({
  user,
}) => {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [archivedInstructors, setArchivedInstructors] = useState<Instructor[]>(
    [],
  );
  const [showInstructorForm, setShowInstructorForm] = useState(false);
  const [showArchivedList, setShowArchivedList] = useState(false);
  const [newInstructorName, setNewInstructorName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [archivedSearchQuery, setArchivedSearchQuery] = useState("");
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

  // Pagination states
  const [activePage, setActivePage] = useState(1);
  const [activePageSize, setActivePageSize] = useState(10);
  const [activeTotalPages, setActiveTotalPages] = useState(1);
  const [activeTotalCount, setActiveTotalCount] = useState(0);
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedPageSize, setArchivedPageSize] = useState(10);
  const [archivedTotalPages, setArchivedTotalPages] = useState(1);
  const [archivedTotalCount, setArchivedTotalCount] = useState(0);

  // Stats
  const [totalActive, setTotalActive] = useState(0);
  const [totalArchived, setTotalArchived] = useState(0);
  const [totalUnavailable, setTotalUnavailable] = useState(0);

  useEffect(() => {
    fetchStats();
    if (showArchivedList) {
      fetchArchivedInstructors();
    } else {
      fetchActiveInstructors();
    }
  }, [
    showArchivedList,
    activePage,
    activePageSize,
    archivedPage,
    archivedPageSize,
    searchQuery,
    archivedSearchQuery,
  ]);

  const fetchStats = async () => {
    try {
      const response = await axios.get("/api/instructors", {
        params: { limit: 1000, archived: false },
      });
      const allActive = response.data.data || response.data || [];
      setTotalActive(allActive.length);
      setTotalUnavailable(
        allActive.filter((i: Instructor) => i.unavailable).length,
      );

      const archivedResponse = await axios.get("/api/instructors", {
        params: { archived: true, limit: 1000 },
      });
      const allArchived =
        archivedResponse.data.data || archivedResponse.data || [];
      setTotalArchived(allArchived.length);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchActiveInstructors = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/instructors", {
        params: {
          archived: false,
          page: activePage,
          limit: activePageSize,
          search: searchQuery || undefined,
        },
      });

      if (response.data.data) {
        setInstructors(response.data.data);
        setActiveTotalPages(response.data.pagination?.pages || 1);
        setActiveTotalCount(response.data.pagination?.total || 0);
      } else {
        setInstructors(response.data);
        setActiveTotalPages(1);
        setActiveTotalCount(response.data.length || 0);
      }
    } catch (error: any) {
      setError("Failed to fetch instructors");
    } finally {
      setLoading(false);
    }
  };

  const fetchArchivedInstructors = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/instructors", {
        params: {
          archived: true,
          page: archivedPage,
          limit: archivedPageSize,
          search: archivedSearchQuery || undefined,
        },
      });

      if (response.data.data) {
        setArchivedInstructors(response.data.data);
        setArchivedTotalPages(response.data.pagination?.pages || 1);
        setArchivedTotalCount(response.data.pagination?.total || 0);
      } else {
        setArchivedInstructors(response.data);
        setArchivedTotalPages(1);
        setArchivedTotalCount(response.data.length || 0);
      }
    } catch (error: any) {
      setError("Failed to fetch archived instructors");
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
      fetchActiveInstructors();
      fetchStats();
      setSuccess("Instructor added successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to add instructor");
    }
  };

  const handleEditInstructor = (
    id: string,
    currentName: string,
    version?: number,
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

      if (editingVersion !== undefined) {
        payload.version = editingVersion;
      }

      await axios.put(`/api/instructors/${id}`, payload);
      fetchActiveInstructors();
      setSuccess("Instructor name updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
      setEditingId(null);
      setEditingName("");
      setEditingVersion(undefined);
    } catch (error: any) {
      if (error.response?.status === 409) {
        setError(
          "This instructor was updated by someone else. Please refresh and try again.",
        );
      } else {
        setError(
          error.response?.data?.message || "Failed to update instructor name",
        );
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleArchiveClick = (instructor: Instructor) => {
    setConfirmAction({
      type: "archive",
      id: instructor._id,
      name: instructor.name,
      version: instructor.version,
    });
    setShowConfirmModal(true);
  };

  const handleRestoreClick = (instructor: Instructor) => {
    setConfirmAction({
      type: "restore",
      id: instructor._id,
      name: instructor.name,
      version: instructor.version,
    });
    setShowConfirmModal(true);
  };

  const handleUnavailableClick = (instructor: Instructor) => {
    setUnavailableModalData({
      id: instructor._id,
      name: instructor.name,
      version: instructor.version,
      reason: instructor.unavailableReason || "",
    });
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

      if (unavailableModalData.version !== undefined) {
        payload.version = unavailableModalData.version;
      }

      await axios.put(`/api/instructors/${unavailableModalData.id}`, payload);
      fetchActiveInstructors();
      fetchStats();
      setSuccess(
        `Instructor ${
          isUnavailable ? "marked as unavailable" : "marked as available"
        } successfully!`,
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
          "This instructor was updated by someone else. Please refresh and try again.",
        );
      } else {
        setError(
          error.response?.data?.message ||
            "Failed to update instructor availability",
        );
      }
    }
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;

    try {
      const archived = confirmAction.type === "archive";
      const payload: any = { archived };

      if (confirmAction.version !== undefined) {
        payload.version = confirmAction.version;
      }

      await axios.put(`/api/instructors/${confirmAction.id}`, payload);

      setSuccess(
        `Instructor ${
          confirmAction.type === "archive" ? "archived" : "restored"
        } successfully!`,
      );
      setTimeout(() => setSuccess(""), 3000);
      setShowConfirmModal(false);
      setConfirmAction(null);
      fetchStats();

      if (confirmAction.type === "archive") {
        setShowArchivedList(false);
        setActivePage(1);
        fetchActiveInstructors();
      } else {
        setArchivedPage(1);
        fetchArchivedInstructors();
      }
    } catch (error: any) {
      if (error.response?.status === 409) {
        setError(
          "This instructor was updated by someone else. Please refresh and try again.",
        );
      } else {
        setError(
          error.response?.data?.message ||
            `Failed to ${confirmAction.type} instructor`,
        );
      }
      setShowConfirmModal(false);
      setConfirmAction(null);
    }
  };

  const handleViewArchived = () => {
    setShowArchivedList(true);
    setSearchQuery("");
    setArchivedPage(1);
  };

  const handleViewActive = () => {
    setShowArchivedList(false);
    setArchivedSearchQuery("");
    setActivePage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (showArchivedList) {
      setArchivedSearchQuery(e.target.value);
      setArchivedPage(1);
    } else {
      setSearchQuery(e.target.value);
      setActivePage(1);
    }
  };

  const handleClearSearch = () => {
    if (showArchivedList) {
      setArchivedSearchQuery("");
      setArchivedPage(1);
    } else {
      setSearchQuery("");
      setActivePage(1);
    }
  };

  const getAvailabilityBadge = (instructor: Instructor) => {
    if (instructor.unavailable) {
      return (
        <span className="badge badge-unavailable">
          <span className="badge-icon">⚠️</span>
          Unavailable
        </span>
      );
    }
    return (
      <span className="badge badge-available">
        <span className="badge-icon">✅</span>
        Available
      </span>
    );
  };

  if (loading && instructors.length === 0 && archivedInstructors.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading instructors...</p>
      </div>
    );
  }

  return (
    <div className="instructor-management">
      <div className="page-header">
        <div className="header-content">
          <h1>Instructor Management</h1>
          <p>
            Add, manage, and track instructor availability for time-in forms
          </p>
        </div>
        <div className="header-stats">
          <div className="stat-chip">
            <span className="stat-label">Active</span>
            <span className="stat-value">{totalActive}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Unavailable</span>
            <span className="stat-value">{totalUnavailable}</span>
          </div>
          <div className="stat-chip">
            <span className="stat-label">Archived</span>
            <span className="stat-value">{totalArchived}</span>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div className="card-header">
          <h2>
            {showArchivedList ? (
              <>
                <span className="header-icon">📦</span>
                Archived Instructors
              </>
            ) : (
              <>
                <span className="header-icon">👨‍🏫</span>
                Active Instructors
              </>
            )}
          </h2>
          <div className="header-actions">
            {!showArchivedList && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  setNewInstructorName("");
                  setError("");
                  setShowInstructorForm(true);
                }}
              >
                <span className="btn-icon">➕</span>
                Add Instructor
              </button>
            )}
            <button
              className={`btn ${showArchivedList ? "btn-secondary" : "btn-outline"}`}
              onClick={showArchivedList ? handleViewActive : handleViewArchived}
            >
              <span className="btn-icon">{showArchivedList ? "👁️" : "📦"}</span>
              {showArchivedList
                ? "View Active"
                : `View Archived (${totalArchived})`}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder={
                showArchivedList
                  ? "Search archived instructors..."
                  : "Search instructors by name..."
              }
              value={showArchivedList ? archivedSearchQuery : searchQuery}
              onChange={handleSearchChange}
            />
            {(searchQuery || archivedSearchQuery) && (
              <button
                className="search-clear"
                onClick={handleClearSearch}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Active Instructors View */}
        {!showArchivedList && (
          <div className="instructors-list">
            {instructors.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👨‍🏫</div>
                <h3>No Instructors Found</h3>
                <p>
                  {searchQuery
                    ? `No instructors matching "${searchQuery}"`
                    : "Get started by adding your first instructor"}
                </p>
                {!searchQuery && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowInstructorForm(true)}
                  >
                    Add Instructor
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="instructor-grid">
                  {instructors.map((instructor) => (
                    <div key={instructor._id} className="instructor-card">
                      <div className="card-header">
                        <div className="instructor-avatar">
                          {instructor.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="instructor-info">
                          {editingId === instructor._id ? (
                            <div className="edit-mode">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="edit-input"
                                autoFocus
                              />
                              <div className="edit-actions">
                                <button
                                  onClick={() => handleSaveName(instructor._id)}
                                  className="btn-icon-only success"
                                  title="Save"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="btn-icon-only danger"
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <h3 className="instructor-name">
                                {instructor.name}
                              </h3>
                              <div className="instructor-badges">
                                {getAvailabilityBadge(instructor)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {instructor.unavailable &&
                        instructor.unavailableReason && (
                          <div className="unavailable-reason">
                            <span className="reason-label">Reason:</span>
                            <span className="reason-text">
                              {instructor.unavailableReason}
                            </span>
                          </div>
                        )}

                      <div className="card-actions">
                        {editingId !== instructor._id && (
                          <>
                            <button
                              className="btn-icon-label"
                              onClick={() =>
                                handleEditInstructor(
                                  instructor._id,
                                  instructor.name,
                                  instructor.version,
                                )
                              }
                              title="Edit name"
                            >
                              <span className="btn-icon">✏️</span>
                              Edit
                            </button>
                            <button
                              className={`btn-icon-label ${
                                instructor.unavailable ? "warning" : "success"
                              }`}
                              onClick={() => handleUnavailableClick(instructor)}
                              title={
                                instructor.unavailable
                                  ? "Mark as available"
                                  : "Mark as unavailable"
                              }
                            >
                              <span className="btn-icon">
                                {instructor.unavailable ? "✅" : "⏸️"}
                              </span>
                              {instructor.unavailable
                                ? "Available"
                                : "Unavailable"}
                            </button>
                            <button
                              className="btn-icon-label warning"
                              onClick={() => handleArchiveClick(instructor)}
                              title="Archive instructor"
                            >
                              <span className="btn-icon">📦</span>
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {activeTotalPages > 1 && (
                  <div className="pagination">
                    <div className="pagination-info">
                      Showing {(activePage - 1) * activePageSize + 1} to{" "}
                      {Math.min(activePage * activePageSize, activeTotalCount)}{" "}
                      of {activeTotalCount} instructors
                    </div>
                    <div className="pagination-controls">
                      <button
                        className="btn-pagination"
                        disabled={activePage <= 1}
                        onClick={() => setActivePage((p) => p - 1)}
                      >
                        ← Prev
                      </button>
                      <div className="page-numbers">
                        {[...Array(Math.min(5, activeTotalPages))].map(
                          (_, i) => {
                            let pageNum: number;
                            if (activeTotalPages <= 5) {
                              pageNum = i + 1;
                            } else if (activePage <= 3) {
                              pageNum = i + 1;
                            } else if (activePage >= activeTotalPages - 2) {
                              pageNum = activeTotalPages - 4 + i;
                            } else {
                              pageNum = activePage - 2 + i;
                            }
                            return (
                              <button
                                key={pageNum}
                                className={`btn-page ${activePage === pageNum ? "active" : ""}`}
                                onClick={() => setActivePage(pageNum)}
                              >
                                {pageNum}
                              </button>
                            );
                          },
                        )}
                      </div>
                      <button
                        className="btn-pagination"
                        disabled={activePage >= activeTotalPages}
                        onClick={() => setActivePage((p) => p + 1)}
                      >
                        Next →
                      </button>
                      <select
                        className="page-size-select"
                        value={activePageSize}
                        onChange={(e) => {
                          setActivePageSize(Number(e.target.value));
                          setActivePage(1);
                        }}
                      >
                        <option value={10}>10 / page</option>
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Archived Instructors View */}
        {showArchivedList && (
          <div className="instructors-list">
            {archivedInstructors.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <h3>No Archived Instructors</h3>
                <p>
                  {archivedSearchQuery
                    ? `No archived instructors matching "${archivedSearchQuery}"`
                    : "Archived instructors will appear here"}
                </p>
              </div>
            ) : (
              <>
                <div className="instructor-grid">
                  {archivedInstructors.map((instructor) => (
                    <div
                      key={instructor._id}
                      className="instructor-card archived"
                    >
                      <div className="card-header">
                        <div className="instructor-avatar archived">
                          {instructor.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="instructor-info">
                          <h3 className="instructor-name">{instructor.name}</h3>
                          <span className="badge badge-archived">
                            <span className="badge-icon">📦</span>
                            Archived
                          </span>
                        </div>
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn-icon-label success"
                          onClick={() => handleRestoreClick(instructor)}
                          title="Restore instructor"
                        >
                          <span className="btn-icon">♻️</span>
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination for Archived */}
                {archivedTotalPages > 1 && (
                  <div className="pagination">
                    <div className="pagination-info">
                      Showing {(archivedPage - 1) * archivedPageSize + 1} to{" "}
                      {Math.min(
                        archivedPage * archivedPageSize,
                        archivedTotalCount,
                      )}{" "}
                      of {archivedTotalCount} archived instructors
                    </div>
                    <div className="pagination-controls">
                      <button
                        className="btn-pagination"
                        disabled={archivedPage <= 1}
                        onClick={() => setArchivedPage((p) => p - 1)}
                      >
                        ← Prev
                      </button>
                      <div className="page-numbers">
                        {[...Array(Math.min(5, archivedTotalPages))].map(
                          (_, i) => {
                            let pageNum: number;
                            if (archivedTotalPages <= 5) {
                              pageNum = i + 1;
                            } else if (archivedPage <= 3) {
                              pageNum = i + 1;
                            } else if (archivedPage >= archivedTotalPages - 2) {
                              pageNum = archivedTotalPages - 4 + i;
                            } else {
                              pageNum = archivedPage - 2 + i;
                            }
                            return (
                              <button
                                key={pageNum}
                                className={`btn-page ${archivedPage === pageNum ? "active" : ""}`}
                                onClick={() => setArchivedPage(pageNum)}
                              >
                                {pageNum}
                              </button>
                            );
                          },
                        )}
                      </div>
                      <button
                        className="btn-pagination"
                        disabled={archivedPage >= archivedTotalPages}
                        onClick={() => setArchivedPage((p) => p + 1)}
                      >
                        Next →
                      </button>
                      <select
                        className="page-size-select"
                        value={archivedPageSize}
                        onChange={(e) => {
                          setArchivedPageSize(Number(e.target.value));
                          setArchivedPage(1);
                        }}
                      >
                        <option value={10}>10 / page</option>
                        <option value={25}>25 / page</option>
                        <option value={50}>50 / page</option>
                        <option value={100}>100 / page</option>
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Instructor Modal */}
      {showInstructorForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New Instructor</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowInstructorForm(false);
                  setNewInstructorName("");
                  setError("");
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleAddInstructor}>
              <div className="form-group">
                <label htmlFor="instructorName">Instructor Name</label>
                <input
                  type="text"
                  id="instructorName"
                  value={newInstructorName}
                  onChange={(e) => setNewInstructorName(e.target.value)}
                  placeholder="Enter instructor full name"
                  autoFocus
                  className="form-input"
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowInstructorForm(false);
                    setNewInstructorName("");
                    setError("");
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Instructor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && confirmAction && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>
                {confirmAction.type === "archive"
                  ? "Archive Instructor"
                  : "Restore Instructor"}
              </h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to {confirmAction.type}{" "}
                <strong>{confirmAction.name}</strong>?
              </p>
              {confirmAction.type === "archive" && (
                <p className="warning-text">
                  Archived instructors will no longer appear in time-in forms.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmAction}
                className={`btn ${confirmAction.type === "archive" ? "btn-warning" : "btn-success"}`}
              >
                {confirmAction.type === "archive" ? "Archive" : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unavailable Modal */}
      {showUnavailableModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Instructor Availability</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowUnavailableModal(false);
                  setUnavailableModalData({ id: "", name: "", reason: "" });
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-subtitle">
                <strong>{unavailableModalData.name}</strong>
              </p>
              <div className="form-group">
                <label htmlFor="unavailableReason">
                  Reason (leave empty to mark as available):
                </label>
                <textarea
                  id="unavailableReason"
                  value={unavailableModalData.reason}
                  onChange={(e) =>
                    setUnavailableModalData({
                      ...unavailableModalData,
                      reason: e.target.value,
                    })
                  }
                  placeholder="e.g., On leave, Sick leave, Training, etc."
                  className="form-textarea"
                  rows={4}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button
                onClick={() => {
                  setShowUnavailableModal(false);
                  setUnavailableModalData({ id: "", name: "", reason: "" });
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUnavailable}
                className={`btn ${
                  unavailableModalData.reason.trim()
                    ? "btn-warning"
                    : "btn-success"
                }`}
              >
                {unavailableModalData.reason.trim()
                  ? "Mark as Unavailable"
                  : "Mark as Available"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorManagement;
