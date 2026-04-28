import React, { useState } from "react";
import axios from "axios";
import {
  Upload,
  FileText,
  Loader,
  CheckCircle,
  X,
  AlertCircle,
} from "lucide-react";
import "./PDFUploader.css";

interface ExtractedSchedule {
  day: string;
  time: string;
  room: string;
  section: string;
  subjectCode: string;
  instructor: string;
  classroomExists?: boolean;
  validationStatus?: string;
  isMajor?: boolean;
}

interface Classroom {
  _id: string;
  name: string;
  capacity: number;
  location: string;
  equipment: string[];
  isAvailable: boolean;
  description?: string;
  version?: number;
  schedules?: any[];
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

interface PDFUploaderProps {
  onClose: () => void;
  onImportComplete?: () => void;
  targetClassroom?: Classroom | null; // NEW: Target classroom to filter schedules
}

const PDFUploader: React.FC<PDFUploaderProps> = ({
  onClose,
  onImportComplete,
  targetClassroom = null,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [schedules, setSchedules] = useState<ExtractedSchedule[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [totalExtracted, setTotalExtracted] = useState(0);
  const [importSummary, setImportSummary] = useState<any>(null);

  // Filter schedules to ONLY match the target classroom
  const filteredSchedules = targetClassroom
    ? schedules.filter((s) => {
        // Extract room number from schedule
        const scheduleRoomNum = s.room.match(/\d+/)?.[0];
        const targetRoomNum = targetClassroom.name.match(/\d+/)?.[0];
        return scheduleRoomNum === targetRoomNum;
      })
    : schedules;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setError("");
    setSuccess("");
    setSchedules([]);
    setImportSummary(null);

    const formData = new FormData();
    formData.append("pdf", selectedFile);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "/api/classrooms/upload-schedule",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data.success) {
        setSchedules(response.data.schedules || []);
        setTotalExtracted(response.data.totalExtracted || 0);

        // Show appropriate success message
        if (targetClassroom) {
          const matchingCount = (response.data.schedules || []).filter(
            (s: ExtractedSchedule) => {
              const scheduleRoomNum = s.room.match(/\d+/)?.[0];
              const targetRoomNum = targetClassroom.name.match(/\d+/)?.[0];
              return scheduleRoomNum === targetRoomNum;
            },
          ).length;

          setSuccess(
            `Extracted ${response.data.totalExtracted} total schedules, ${matchingCount} for ${targetClassroom.name}!`,
          );
        } else {
          setSuccess(
            `Successfully extracted ${response.data.totalExtracted} schedules!`,
          );
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to parse PDF");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (filteredSchedules.length === 0) {
      setError(
        `No schedules found for ${targetClassroom?.name || "this classroom"}`,
      );
      return;
    }

    setImporting(true);
    setError("");

    try {
      const token = localStorage.getItem("token");

      // Force all schedules to use the target classroom's name
      let schedulesToImport = filteredSchedules;
      if (targetClassroom) {
        schedulesToImport = filteredSchedules.map((s) => ({
          ...s,
          room: targetClassroom.name, // Force the exact classroom name
        }));
      }

      const response = await axios.post(
        "/api/classrooms/bulk-import-schedules",
        { schedules: schedulesToImport },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.data.success) {
        setImportSummary(response.data.summary);
        setSuccess(
          response.data.message ||
            `Successfully imported ${response.data.summary.added} schedules to ${targetClassroom?.name || "classrooms"}!`,
        );

        setTimeout(() => {
          onImportComplete?.();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to import schedules");
    } finally {
      setImporting(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setSchedules([]);
    setSuccess("");
    setError("");
    setImportSummary(null);
  };

  const getTitle = () => {
    if (targetClassroom) {
      return `Import Schedule - ${targetClassroom.name}`;
    }
    return "Import Room Utilization PDF";
  };

  const getSubtitle = () => {
    if (targetClassroom) {
      return `Only schedules for ${targetClassroom.name} will be imported`;
    }
    return "Upload the 2nd Sem Room Utilization PDF";
  };

  return (
    <div className="pdf-uploader">
      <div className="uploader-header">
        <h3>
          <FileText size={20} color="#0ec0d4" />
          {getTitle()}
        </h3>
        <button className="close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      {!file ? (
        <div
          className="upload-area"
          onClick={() => document.getElementById("pdf-input")?.click()}
        >
          <Upload size={48} color="#0ec0d4" />
          <p className="upload-text">Click to select PDF file</p>
          <p className="upload-hint">{getSubtitle()}</p>
          <input
            id="pdf-input"
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </div>
      ) : (
        <div className="file-info">
          <FileText size={24} color="#0ec0d4" />
          <span className="file-name">{file.name}</span>
          <button className="clear-file" onClick={handleClearFile}>
            <X size={16} />
          </button>
        </div>
      )}

      {loading && (
        <div className="loading-indicator">
          <Loader size={24} className="spinning" />
          <span>Parsing PDF... This may take a moment</span>
        </div>
      )}

      {error && (
        <div className="alert error">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {success && (
        <div className="alert success">
          <CheckCircle size={18} /> {success}
        </div>
      )}

      {importSummary && (
        <div className="import-summary">
          <h4>Import Summary</h4>
          <div className="summary-stats">
            <div className="stat added">
              <span className="stat-label">Added:</span>
              <span className="stat-value">{importSummary.added}</span>
            </div>
            <div className="stat duplicate">
              <span className="stat-label">Duplicates:</span>
              <span className="stat-value">{importSummary.duplicates}</span>
            </div>
            <div className="stat error">
              <span className="stat-label">Errors:</span>
              <span className="stat-value">{importSummary.errors}</span>
            </div>
          </div>
        </div>
      )}

      {filteredSchedules.length > 0 && (
        <div className="extracted-schedules">
          <h4>
            Schedules for {targetClassroom?.name || "All Rooms"} (
            {filteredSchedules.length})
            {targetClassroom && schedules.length > filteredSchedules.length && (
              <span
                style={{
                  fontSize: "12px",
                  marginLeft: "8px",
                  color: "#f39c12",
                  fontWeight: "normal",
                }}
              >
                (Filtered from {schedules.length} total)
              </span>
            )}
          </h4>

          <div className="schedules-table-container">
            <table className="schedules-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Room</th>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Instructor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchedules.slice(0, 30).map((s, i) => (
                  <tr key={i} className={s.validationStatus}>
                    <td>{s.day}</td>
                    <td>{s.time}</td>
                    <td>{s.room}</td>
                    <td>{s.section}</td>
                    <td>{s.subjectCode}</td>
                    <td>{s.instructor}</td>
                    <td>
                      {s.classroomExists ? (
                        <span className="status-badge ready">Ready</span>
                      ) : (
                        <span className="status-badge warning">No Room</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSchedules.length > 30 && (
              <p className="more-hint">
                + {filteredSchedules.length - 30} more schedules
              </p>
            )}
          </div>

          <div className="import-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleBulkImport}
              disabled={importing}
            >
              {importing ? (
                <>
                  <Loader size={16} className="spinning" />
                  Importing...
                </>
              ) : (
                <>Import to {targetClassroom?.name || "Classrooms"}</>
              )}
            </button>
          </div>
        </div>
      )}

      {file &&
        !loading &&
        filteredSchedules.length === 0 &&
        schedules.length > 0 && (
          <div className="alert warning" style={{ marginTop: "16px" }}>
            <AlertCircle size={18} />
            No schedules found for {targetClassroom?.name}. Try importing from
            the correct classroom's schedule modal.
          </div>
        )}
    </div>
  );
};

export default PDFUploader;
