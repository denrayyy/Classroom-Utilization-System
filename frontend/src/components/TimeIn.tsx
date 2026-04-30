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

interface MatchedSchedule {
  day: string;
  time: string;
  section: string;
  subjectCode: string;
  instructor: string;
  scheduledStartTime: string;
  instructorStatus?: {
    name: string;
    unavailable?: boolean;
    unavailableReason?: string;
    travelStatus?: string;
    travelDetails?: string;
    teachingElsewhere?: boolean;
    activeTeachingSession?: {
      classroom: string;
      timeIn: string;
    } | null;
  };
}

interface AvailableClassOption {
  id: string;
  displayLabel: string;
  available: boolean;
  statusReasons: string[];
  classroom: {
    id: string;
    name: string;
    location: string;
  };
  schedule: {
    day: string;
    time: string;
    section: string;
    subjectCode: string;
    instructor: string;
    scheduledStartTime: string;
  };
  instructorStatus: MatchedSchedule["instructorStatus"];
  classroomStatus: {
    occupied: boolean;
    occupiedBy: string;
    occupiedSince: string | null;
  };
}

const TimeIn: React.FC<TimeInProps> = ({ user, onBack }) => {
  const [timeInHour, setTimeInHour] = useState("");
  const [timeInMinute, setTimeInMinute] = useState("");
  const [timeInPeriod, setTimeInPeriod] = useState("AM");
  const [availableClasses, setAvailableClasses] = useState<AvailableClassOption[]>([]);
  const [selectedClassOptionId, setSelectedClassOptionId] = useState("");
  const [excludeComLabs, setExcludeComLabs] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [instructorName, setInstructorName] = useState("");
  const [section, setSection] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [classType, setClassType] = useState("in-class");
  const [reason, setReason] = useState("");
  const [reasonOptions, setReasonOptions] = useState<string[]>([
    "Travel",
    "Sick",
    "Absent",
    "Seminar",
    "Meeting",
  ]);
  const [scheduledStartTime, setScheduledStartTime] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [timeInData, setTimeInData] = useState<any>(null);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [matchedSchedule, setMatchedSchedule] =
    useState<MatchedSchedule | null>(null);
  const [scheduleInstructorStatus, setScheduleInstructorStatus] = useState<
    MatchedSchedule["instructorStatus"] | null
  >(null);

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
  const selectedTimeLabel =
    timeInHour && timeInMinute && timeInPeriod
      ? `${Number.parseInt(timeInHour, 10)}:${String(
          Number.parseInt(timeInMinute, 10),
        ).padStart(2, "0")} ${timeInPeriod}`
      : "";

  useEffect(() => {
    checkHoliday();
  }, []);

  useEffect(() => {
    const fetchNoClassReasons = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("/api/settings/no-class-reasons", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok && Array.isArray(data) && data.length) {
          const sanitized = data
            .map((item: any) => String(item || "").trim())
            .filter(Boolean);
          if (sanitized.length) {
            setReasonOptions(sanitized);
          }
        }
      } catch (error) {
        console.error("Failed to fetch no-class reasons:", error);
      }
    };

    fetchNoClassReasons();
  }, []);

  useEffect(() => {
    if (!timeInHour || !timeInMinute || !timeInPeriod) {
      setAvailableClasses([]);
      setSelectedClassOptionId("");
      setMatchedSchedule(null);
      setScheduleInstructorStatus(null);
      setSelectedClassroom("");
      setInstructorName("");
      setSection("");
      setSubjectCode("");
      setScheduledStartTime("");
      setOccupancyWarning(null);
      return;
    }
    fetchAvailableClasses();
  }, [timeInHour, timeInMinute, timeInPeriod]);

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

  const fetchAvailableClasses = async () => {
    try {
      const token = localStorage.getItem("token");
      const timeValue = `${Number.parseInt(timeInHour, 10)}:${String(
        Number.parseInt(timeInMinute, 10),
      ).padStart(2, "0")}`;
      const query = `?time=${encodeURIComponent(timeValue)}&period=${encodeURIComponent(timeInPeriod)}`;
      const response = await fetch(
        `/api/timein/available-classes${query}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load available classes");
      }

      setAvailableClasses(data.classes || []);
      setSelectedClassOptionId("");
      setMatchedSchedule(null);
      setScheduleInstructorStatus(null);
      setSelectedClassroom("");
      setInstructorName("");
      setSection("");
      setSubjectCode("");
      setScheduledStartTime("");
      setOccupancyWarning(null);
    } catch (error) {
      console.error("Failed to load available classes:", error);
      setAvailableClasses([]);
      setSelectedClassOptionId("");
      setMatchedSchedule(null);
      setScheduleInstructorStatus(null);
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

  const handleAvailableClassChange = (value: string) => {
    setSelectedClassOptionId(value);
    const selectedOption = availableClasses.find((item) => item.id === value);
    if (!selectedOption) {
      setSelectedClassroom("");
      setMatchedSchedule(null);
      setScheduleInstructorStatus(null);
      setInstructorName("");
      setSection("");
      setSubjectCode("");
      setScheduledStartTime("");
      setOccupancyWarning(null);
      return;
    }

    setSelectedClassroom(selectedOption.classroom.id);
    setInstructorName(selectedOption.schedule.instructor || "");
    setSection(selectedOption.schedule.section || "");
    setSubjectCode(selectedOption.schedule.subjectCode || "");
    setScheduledStartTime(selectedOption.schedule.scheduledStartTime || "");
    setMatchedSchedule({
      day: selectedOption.schedule.day,
      time: selectedOption.schedule.time,
      section: selectedOption.schedule.section,
      subjectCode: selectedOption.schedule.subjectCode,
      instructor: selectedOption.schedule.instructor,
      scheduledStartTime: selectedOption.schedule.scheduledStartTime,
      instructorStatus: selectedOption.instructorStatus || undefined,
    });
    setScheduleInstructorStatus(selectedOption.instructorStatus || null);
    setOccupancyWarning(
      selectedOption.classroomStatus?.occupied
        ? {
            occupiedBy: selectedOption.classroomStatus.occupiedBy,
            instructorName: selectedOption.schedule.instructor,
            since: selectedOption.classroomStatus.occupiedSince,
          }
        : null,
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClassroom) {
      setError("Please select a classroom");
      return;
    }

    if (classType === "in-class" && !matchedSchedule) {
      setError("No active schedule matches the current time for this room.");
      return;
    }

    if (classType === "in-class" && !instructorName.trim()) {
      setError("Please select a classroom with an active instructor schedule.");
      return;
    }

    if (classType === "no-class" && !reason.trim()) {
      setError("Please provide a reason for No Class.");
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
      const hour = Number.parseInt(timeInHour, 10);
      const minute = Number.parseInt(timeInMinute, 10);

      formData.append("classroom", selectedClassroom);
      if (evidence) formData.append("evidence", evidence);
      formData.append("instructorName", instructorName);
      formData.append("classType", classType);
      if (
        Number.isNaN(hour) ||
        Number.isNaN(minute) ||
        hour < 1 ||
        hour > 12 ||
        minute < 0 ||
        minute > 59
      ) {
        setError("Please enter a valid manual time-in.");
        setLoading(false);
        return;
      }
      formData.append("timeInHour", String(hour));
      formData.append("timeInMinute", String(minute).padStart(2, "0"));
      formData.append("timeInPeriod", timeInPeriod);

      const customTimeInDate = new Date();
      let hour24 = hour % 12;
      if (timeInPeriod === "PM") hour24 += 12;
      customTimeInDate.setHours(hour24, minute, 0, 0);
      formData.append("customTimeIn", customTimeInDate.toISOString());

      // ✅ NEW: Send additional fields
      if (section) formData.append("section", section);
      if (subjectCode) formData.append("subjectCode", subjectCode);
      if (scheduledStartTime)
        formData.append("scheduledStartTime", scheduledStartTime);
      if (classType === "no-class" && reason) {
        formData.append("reason", reason);
      }

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
        setReason("");
        setMatchedSchedule(null);
        setScheduleInstructorStatus(null);
        setOccupancyWarning(null);
        setTimeInHour("");
        setTimeInMinute("");
        setTimeInPeriod("AM");

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

  const selectedClassOption = availableClasses.find(
    (item) => item.id === selectedClassOptionId,
  );

  if (success) {
    let displayTime = selectedTimeLabel || "";
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

        {classType === "in-class" &&
          timeInHour &&
          timeInMinute &&
          timeInPeriod &&
          availableClasses.length === 0 && (
          <div className="warning-box">
            <Info size={16} color="#ffc107" />
            <div>
              <strong>No active schedule found.</strong>
              <p>
                No classes are scheduled for {selectedTimeLabel || "the selected time"}.
              </p>
            </div>
          </div>
        )}

        {matchedSchedule && (
          <div className="warning-box" style={{ borderColor: "#0ec0d4" }}>
            <Info size={16} color="#0ec0d4" />
            <div>
              <strong>Current matched schedule</strong>
              <p>
                {matchedSchedule.day} | {matchedSchedule.time} |{" "}
                {matchedSchedule.section} | {matchedSchedule.subjectCode} |{" "}
                {matchedSchedule.instructor}
              </p>
            </div>
          </div>
        )}

        {/* ✅ Instructor Travel/Leave Status */}
        {(scheduleInstructorStatus?.travelStatus &&
          scheduleInstructorStatus.travelStatus !== "available") ||
        (selectedClassOption?.instructorStatus?.travelStatus &&
          selectedClassOption.instructorStatus.travelStatus !== "available") ? (
            <div className="instructor-travel-banner">
              <Plane size={20} color="#ffc107" />
              <div>
                <strong>
                  Instructor Status:{" "}
                  {(scheduleInstructorStatus?.travelStatus ||
                    selectedClassOption?.instructorStatus?.travelStatus ||
                    "available")
                    .replace("-", " ")
                    .toUpperCase()}
                </strong>
                {(scheduleInstructorStatus?.travelDetails ||
                  selectedClassOption?.instructorStatus?.travelDetails) && (
                  <p>
                    {scheduleInstructorStatus?.travelDetails ||
                      selectedClassOption?.instructorStatus?.travelDetails}
                  </p>
                )}
              </div>
            </div>
          ) : null}

        {/* ✅ Instructor Unavailable Warning */}
        {(scheduleInstructorStatus?.unavailable ||
          selectedClassOption?.instructorStatus?.unavailable) && (
          <div className="warning-box">
            <AlertTriangle size={16} color="#ffc107" />
            <div>
              <strong>Warning:</strong> This instructor is currently
              unavailable.
              {(scheduleInstructorStatus?.unavailableReason ||
                selectedClassOption?.instructorStatus?.unavailableReason) && (
                <p>
                  <strong>Reason:</strong>{" "}
                  {scheduleInstructorStatus?.unavailableReason ||
                    selectedClassOption?.instructorStatus?.unavailableReason}
                </p>
              )}
            </div>
          </div>
        )}

        {scheduleInstructorStatus?.teachingElsewhere && (
          <div className="warning-box">
            <AlertTriangle size={16} color="#dc3545" />
            <div>
              <strong>Instructor conflict:</strong>{" "}
              {scheduleInstructorStatus.name} is currently teaching in{" "}
              {scheduleInstructorStatus.activeTeachingSession?.classroom || "another classroom"}.
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
                  Upload Photo (Optional)
                </button>
                {evidence && (
                  <p className="file-info">Selected: {evidence.name}</p>
                )}
              </div>
            </div>

            <div className="form-fields">
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

              {/* ✅ Class Type and Reason */}
              <div className="field-group">
                <label>Class Type:</label>
                <select
                  value={classType}
                  onChange={(e) => {
                    setClassType(e.target.value);
                    if (e.target.value !== "no-class") setReason("");
                  }}
                  className="form-field"
                  style={{ width: "100%" }}
                >
                  <option value="in-class">In-Class</option>
                  <option value="no-class">No Class</option>
                </select>
              </div>
              {classType === "no-class" && (
                <div className="field-group">
                  <label>Reason:</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="form-field"
                    style={{ width: "100%" }}
                    required
                  >
                    <option value="">Select reason</option>
                    {reasonOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time-In Field */}
              <div className="field-group">
                <label>Time-In:</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    placeholder="HH"
                    className="form-field"
                    style={{ width: 70 }}
                    value={timeInHour}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setTimeInHour(val ? Math.max(1, Math.min(12, parseInt(val))).toString() : "");
                    }}
                    required
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    placeholder="MM"
                    className="form-field"
                    style={{ width: 70 }}
                    value={timeInMinute}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      setTimeInMinute(val ? Math.max(0, Math.min(59, parseInt(val))).toString() : "");
                    }}
                    required
                  />
                  <select
                    className="form-field"
                    style={{ width: 70 }}
                    value={timeInPeriod}
                    onChange={e => setTimeInPeriod(e.target.value)}
                    required
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              {/* Classroom */}
              <div className="field-group">
                <label>Available Classes:</label>
                <select
                  value={selectedClassOptionId}
                  onChange={(e) => handleAvailableClassChange(e.target.value)}
                  required
                  className="form-field"
                >
                  <option value="">Select class for this time slot</option>
                  {availableClasses.map((classOption) => (
                    <option key={classOption.id} value={classOption.id}>
                      {classOption.displayLabel}{" "}
                      {classOption.available ? "[Available]" : "[Unavailable]"}
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
                  readOnly
                  placeholder="Auto-filled from current room schedule"
                  className="form-field readonly-field"
                />
              </div>

              {/* ✅ Subject Code */}
              <div className="field-group">
                <label>Subject Code:</label>
                <input
                  type="text"
                  value={subjectCode}
                  readOnly
                  placeholder="Auto-filled from current room schedule"
                  className="form-field readonly-field"
                />
              </div>

              {/* ✅ Scheduled Start Time */}
              <div className="field-group">
                <label>Scheduled Start Time:</label>
                <input
                  type="text"
                  value={scheduledStartTime}
                  readOnly
                  placeholder="Auto-filled from current room schedule"
                  className="form-field readonly-field"
                />
              </div>

              {/* Instructor */}
              <div className="field-group">
                <label>Instructor Name:</label>
                <input
                  type="text"
                  value={instructorName}
                  readOnly
                  required
                  placeholder="Auto-filled from current room schedule"
                  className="form-field readonly-field"
                />
              </div>

              {/* Remarks removed, now Reason is next to Class Type */}
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="submit"
              className="btn-timein"
              disabled={
                loading ||
                !!occupancyWarning ||
                (classType === "in-class" &&
                  !!selectedClassroom &&
                  !matchedSchedule)
              }
            >
              {loading
                ? "Processing..."
                : occupancyWarning
                  ? "Classroom Occupied"
                  : classType === "in-class" &&
                      selectedClassroom &&
                      !matchedSchedule
                    ? "No Active Schedule"
                    : "Time-In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TimeIn;
