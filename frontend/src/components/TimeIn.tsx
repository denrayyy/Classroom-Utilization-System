import React, { useState, useEffect } from "react";
import "./TimeIn.css";
import { Upload, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";

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
}

const TimeIn: React.FC<TimeInProps> = ({ user, onBack }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [excludeComLabs, setExcludeComLabs] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [instructorName, setInstructorName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [timeInData, setTimeInData] = useState<any>(null);

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
  }, []);

  useEffect(() => {
    fetchClassrooms();
  }, [excludeComLabs]);

  const fetchClassrooms = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please log in again.");
        return;
      }
      const query = excludeComLabs ? "?excludeComputerLabs=true" : "";
      const response = await fetch(`/api/classrooms${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Instructors API response:", data);

        let instructorArray: Instructor[] = [];

        if (Array.isArray(data)) {
          instructorArray = data;
        } else if (data && data.data && Array.isArray(data.data)) {
          instructorArray = data.data;
        } else if (data && typeof data === "object") {
          const possibleArray = Object.values(data).find((val) =>
            Array.isArray(val),
          );
          if (possibleArray) {
            instructorArray = possibleArray as Instructor[];
          }
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
      if (remarks) formData.append("remarks", remarks);

      console.log("Sending time-in request...", {
        selectedClassroom,
        evidence: evidence?.name,
        remarks,
      });

      const response = await fetch("/api/timein", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);

      if (response.ok) {
        setTimeInData(data.timeInRecord);
        setSuccess(true);
        setSelectedClassroom("");
        setEvidence(null);
        setInstructorName("");
        setRemarks("");
        const fileInput = document.getElementById(
          "evidence",
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";

        setTimeout(() => {
          onBack();
        }, 2000);
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

  if (success) {
    let displayTime = formattedTime;
    if (timeInData && timeInData.timeIn) {
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

        <form className="timein-form" onSubmit={handleSubmit}>
          <div className="form-content">
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
              <div className="field-group">
                <label>Time-In:</label>
                <input
                  type="text"
                  value={formattedTime}
                  readOnly
                  className="readonly-field"
                />
              </div>

              <div className="field-group">
                <label>Date:</label>
                <input
                  type="text"
                  value={formattedDate}
                  readOnly
                  className="readonly-field"
                />
              </div>

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
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      Loading instructors...
                    </option>
                  )}
                </select>
                {instructorName &&
                  Array.isArray(instructors) &&
                  (() => {
                    const selectedInstructor = instructors.find(
                      (i) => i.name === instructorName,
                    );
                    if (selectedInstructor?.unavailable) {
                      return (
                        <div className="warning-box">
                          <AlertTriangle size={16} color="#ffc107" />
                          <strong>Warning:</strong> This instructor is currently
                          unavailable.
                          <br />
                          <strong>Reason:</strong>{" "}
                          {selectedInstructor.unavailableReason}
                        </div>
                      );
                    }
                    return null;
                  })()}
              </div>

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
            <button type="submit" className="btn-timein" disabled={loading}>
              {loading ? "Processing..." : "Time-In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeIn;
