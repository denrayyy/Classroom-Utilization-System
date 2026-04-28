import React, { useState, useEffect } from "react";
import "./TimeIn.css";
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Plane,
  Info,
} from "lucide-react";

interface TimeInProps {
  user: { firstName: string; lastName: string; email: string };
  onBack: () => void;
}

interface Classroom {
  _id: string;
  name: string;
  location: string;
  capacity: number;
}

interface Instructor {
  _id: string;
  name: string;
  unavailable?: boolean;
  unavailableReason?: string;
  travelStatus?: string;
  travelDetails?: string;
}

const TimeIn: React.FC<TimeInProps> = ({ user, onBack }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [excludeComLabs, setExcludeComLabs] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [instructorName, setInstructorName] = useState("");
  const [section, setSection] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [classType, setClassType] = useState("synchronous");
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [timeInData, setTimeInData] = useState<any>(null);
  const [warnings, setWarnings] = useState<any[]>([]);

  // ✅ NEW: Holiday state
  const [holiday, setHoliday] = useState<any>(null);

  // ✅ NEW: Classroom occupancy state
  const [occupancyWarning, setOccupancyWarning] = useState<any>(null);

  // Get current date and time
  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const formattedTime = currentDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  useEffect(() => {
    fetchClassrooms();
    fetchInstructors();
    checkHoliday();
  }, []);

  useEffect(() => {
    fetchClassrooms();
  }, [excludeComLabs]);

  // ✅ Check classroom availability when selected
  useEffect(() => {
    if (selectedClassroom) {
      checkClassroomAvailability(selectedClassroom);
    } else {
      setOccupancyWarning(null);
    }
  }, [selectedClassroom]);

  // ✅ Check today's holiday
  const checkHoliday = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/timein/check-holiday", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.isHoliday) {
          setHoliday(data.holiday);
        }
      }
    } catch (error) {
      console.error("Failed to check holiday:", error);
    }
  };

  // ✅ Check classroom availability
  const checkClassroomAvailability = async (classroomId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/timein/availability/${classroomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (!data.available) {
          setOccupancyWarning(data);
        } else {
          setOccupancyWarning(null);
        }
      }
    } catch (error) {
      console.error("Failed to check availability:", error);
    }
  };

  const fetchClassrooms = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please log in again.");
        return;
      }
      const query = excludeComLabs ? "?excludeComputerLabs=true" : "";
      const response = await fetch(`/api/classrooms${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setClassrooms(data);
      }
    } catch (error) {
      console.error("Error fetching classrooms:", error);
      setError("Unable to load classrooms. Please retry.");
    }
  };

  const fetchInstructors = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        "/api/instructors?archived=false&limit=1000",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const data = await response.json();
        let instructorArray: Instructor[] = [];
        if (Array.isArray(data)) {
          instructorArray = data;
        } else if (data?.data && Array.isArray(data.data)) {
          instructorArray = data.data;
        } else if (data && typeof data === "object") {
          const possibleArray = Object.values(data).find((val) =>
            Array.isArray(val),
          );
          if (possibleArray) instructorArray = possibleArray as Instructor[];
        }
        setInstructors(instructorArray);
      }
    } catch (error) {
      console.error("Error fetching instructors:", error);
      setInstructors([]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      setEvidence(file);
      setError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClassroom || !evidence || !instructorName.trim()) {
      setError(
        "Please select a classroom, upload evidence, and select an instructor",
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please log in again.");
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("classroom", selectedClassroom);
      formData.append("evidence", evidence);
      formData.append("instructorName", instructorName);
      formData.append("classType", classType);

      // ✅ NEW: Send additional fields
      if (section) formData.append("section", section);
      if (subjectCode) formData.append("subjectCode", subjectCode);
      if (scheduledStartTime)
        formData.append("scheduledStartTime", scheduledStartTime);
      if (remarks) formData.append("remarks", remarks);

      const response = await fetch("/api/timein", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setTimeInData(data.timeInRecord);
        setWarnings(data.warnings || []);
        setSuccess(true);
        setSelectedClassroom("");
        setEvidence(null);
        setInstructorName("");
        setSection("");
        setSubjectCode("");
        setScheduledStartTime("");
        setRemarks("");
        setOccupancyWarning(null);

        const fileInput = document.getElementById(
          "evidence",
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";

        setTimeout(() => {
          onBack();
        }, 3000);
      } else {
        setError(data.message || "Time-in failed");
      }
    } catch (error) {
      console.error("Time-in error:", error);
      if (error instanceof TypeError && error.message.includes("fetch")) {
        setError(
          "Cannot connect to server. Please make sure the server is running.",
        );
      } else {
        setError("Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ Get instructor status for display
  const getSelectedInstructorStatus = () => {
    if (!instructorName) return null;
    const instructor = instructors.find((i) => i.name === instructorName);
    return instructor;
  };

  const selectedInstructor = getSelectedInstructorStatus();

  if (success) {
    let displayTime = formattedTime;
    if (timeInData?.timeIn) {
      const timeInDate = new Date(timeInData.timeIn);
      displayTime = timeInDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }

    return (
      <div className="status-page">
        <div className="status-box">
          <div className="status-content">
            <div className="status-icon-check">
              <CheckCircle size={80} color="#27ae60" />
            </div>
            <h2 className="status-title">
              Successfully Timed In at {displayTime}
            </h2>
            <p className="status-message">
              Your time-in has been recorded with evidence.
            </p>

            {/* ✅ Show warnings */}
            {warnings.length > 0 && (
              <div className="warnings-list">
                {warnings.map((w, i) => (
                  <div key={i} className={`warning-item warning-${w.type}`}>
                    <AlertTriangle size={16} />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}

            <p
              className="status-message"
              style={{
                fontSize: "14px",
                marginTop: "10px",
                fontStyle: "italic",
              }}
            >
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="timein-page">
      <div className="timein-container">
        <div className="timein-header">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={20} />
            Proof of Timed-in
          </button>
        </div>

        {/* ✅ Holiday Warning Banner */}
        {holiday && (
          <div className="holiday-banner">
            <Calendar size={20} color="#ffc107" />
            <div>
              <strong>📅 Today is {holiday.name}</strong>
              <p>{holiday.type?.toUpperCase()} Holiday</p>
              {holiday.description && (
                <p className="holiday-desc">{holiday.description}</p>
              )}
            </div>
          </div>
        )}

        {/* ✅ Classroom Occupancy Warning */}
        {occupancyWarning && (
          <div className="occupancy-warning-banner">
            <AlertTriangle size={20} color="#dc3545" />
            <div>
              <strong>Classroom Occupied!</strong>
              <p>{occupancyWarning.occupiedBy} is currently using this room</p>
              <p>Instructor: {occupancyWarning.instructorName}</p>
              <p>
                Since: {new Date(occupancyWarning.since).toLocaleTimeString()}
              </p>
            </div>
          </div>
        )}

        {/* ✅ Instructor Travel/Leave Status */}
        {selectedInstructor?.travelStatus &&
          selectedInstructor.travelStatus !== "available" && (
            <div className="instructor-travel-banner">
              <Plane size={20} color="#ffc107" />
              <div>
                <strong>
                  Instructor Status:{" "}
                  {selectedInstructor.travelStatus
                    .replace("-", " ")
                    .toUpperCase()}
                </strong>
                {selectedInstructor.travelDetails && (
                  <p>{selectedInstructor.travelDetails}</p>
                )}
              </div>
            </div>
          )}

        {/* ✅ Instructor Unavailable Warning */}
        {selectedInstructor?.unavailable && (
          <div className="warning-box">
            <AlertTriangle size={16} color="#ffc107" />
            <div>
              <strong>Warning:</strong> This instructor is currently
              unavailable.
              {selectedInstructor.unavailableReason && (
                <p>
                  <strong>Reason:</strong>{" "}
                  {selectedInstructor.unavailableReason}
                </p>
              )}
            </div>
          </div>
        )}

        <form className="timein-form" onSubmit={handleSubmit}>
          <div className="form-content">
            {/* Evidence Upload */}
            <div className="upload-section">
              <div className="upload-area">
                <div className="upload-icon">
                  <Upload size={48} color="#0ec0d4" />
                </div>
                <input
                  type="file"
                  id="evidence"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="file-input"
                />
                <button
                  type="button"
                  className="upload-btn"
                  onClick={() => document.getElementById("evidence")?.click()}
                >
                  Upload Photo
                </button>
                {evidence && (
                  <p className="file-info">Selected: {evidence.name}</p>
                )}
              </div>
            </div>

            <div className="form-fields">
              {/* Time & Date (Read Only) */}
              <div className="field-group">
                <label>
                  <Clock size={16} /> Time-In:
                </label>
                <input
                  type="text"
                  value={formattedTime}
                  readOnly
                  className="readonly-field"
                />
              </div>

              <div className="field-group">
                <label>
                  <Calendar size={16} /> Date:
                </label>
                <input
                  type="text"
                  value={formattedDate}
                  readOnly
                  className="readonly-field"
                />
              </div>

              {/* ✅ Class Type */}
              <div className="field-group">
                <label>Class Type:</label>
                <select
                  value={classType}
                  onChange={(e) => setClassType(e.target.value)}
                  className="form-field"
                >
                  <option value="synchronous">Synchronous (In-Person)</option>
                  <option value="asynchronous">Asynchronous (Online)</option>
                </select>
              </div>

              {/* Classroom */}
              <div className="field-group">
                <label>Classroom:</label>
                <select
                  value={selectedClassroom}
                  onChange={(e) => setSelectedClassroom(e.target.value)}
                  required
                  className="form-field"
                >
                  <option value="">Select Classroom</option>
                  {classrooms.map((classroom) => (
                    <option key={classroom._id} value={classroom._id}>
                      {classroom.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ Section */}
              <div className="field-group">
                <label>Section:</label>
                <input
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  placeholder="e.g., BSIT 3F"
                  className="form-field"
                />
              </div>

              {/* ✅ Subject Code */}
              <div className="field-group">
                <label>Subject Code:</label>
                <input
                  type="text"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  placeholder="e.g., IT 137"
                  className="form-field"
                />
              </div>

              {/* ✅ Scheduled Start Time */}
              <div className="field-group">
                <label>Scheduled Start Time:</label>
                <input
                  type="text"
                  value={scheduledStartTime}
                  onChange={(e) => setScheduledStartTime(e.target.value)}
                  placeholder="e.g., 7:30"
                  className="form-field"
                />
              </div>

              {/* Instructor */}
              <div className="field-group">
                <label>Instructor Name:</label>
                <select
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  required
                  className="form-field"
                >
                  <option value="">Select Instructor</option>
                  {Array.isArray(instructors) && instructors.length > 0 ? (
                    instructors.map((instructor) => (
                      <option
                        key={instructor._id}
                        value={instructor.name}
                        disabled={instructor.unavailable}
                      >
                        {instructor.name}
                        {instructor.unavailable && ` (Unavailable)`}
                        {instructor.travelStatus &&
                          instructor.travelStatus !== "available" &&
                          ` (${instructor.travelStatus})`}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      Loading instructors...
                    </option>
                  )}
                </select>
              </div>

              {/* Remarks */}
              <div className="field-group">
                <label>Remarks (Optional):</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add any remarks..."
                  className="form-field"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="submit"
              className="btn-timein"
              disabled={loading || !!occupancyWarning}
            >
              {loading
                ? "Processing..."
                : occupancyWarning
                  ? "Classroom Occupied"
                  : "Time-In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeIn;
