import mongoose from "mongoose";

/**
 * TimeIn Schema
 * 
 * This model stores student time-in records with evidence uploads.
 * It's designed to track student attendance with photographic proof
 * and includes verification workflow for administrators.
 * 
 * Key Features:
 * - Evidence upload with file metadata storage
 * - Automatic timestamp capture (timeIn, date)
 * - Actual vs scheduled time tracking with late detection
 * - Holiday detection and display
 * - Instructor travel/leave status tracking
 * - Signature capture support
 * - Verification workflow (pending -> verified/rejected)
 * - Student and classroom references
 * - Asynchronous class support
 * - Auto time-out for expired sessions
 * - Archive/delete workflow
 */
const timeInSchema = mongoose.Schema({
  // ========== STUDENT & CLASSROOM ==========
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true
  },
  
  // ========== INSTRUCTOR INFO ==========
  instructorName: {
    type: String,
    required: true
  },
  
  // ========== CLASS DETAILS ==========
  section: {
    type: String,
    default: ''
  },
  subjectCode: {
    type: String,
    default: ''
  },
  classType: {
  type: String,
  enum: ["in-class", "no-class"],
  default: "in-class"
},

reason: {
  type: String,
  default: ''
},

customTimeIn: {
  type: Date,
  default: null
},
  
  // ========== TIME TRACKING ==========
  timeIn: {
    type: Date,
    required: true,
    default: Date.now
  },
  timeOut: {
    type: Date
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // ✅ ACTUAL vs SCHEDULED TIME
  scheduledStartTime: {
    type: String,  // e.g., "7:30"
    default: ''
  },
  isLate: {
    type: Boolean,
    default: false
  },
  
  // ========== EVIDENCE UPLOAD ==========
  evidence: {
    filename: {
      type: String,
      default: ''
    },
    originalName: {
      type: String,
      default: ''
    },
    mimetype: {
      type: String,
      default: ''
    },
    size: {
      type: Number,
      default: 0
    },
    path: {
      type: String,
      default: ''
    }
  },
  
  // ========== HOLIDAY DETECTION ==========
  isHoliday: {
    type: Boolean,
    default: false
  },
  holidayInfo: {
    name: String,
    type: String,
    description: String
  },
  
  // ========== INSTRUCTOR STATUS ==========
  instructorStatus: {
    onTravel: {
      type: Boolean,
      default: false
    },
    onLeave: {
      type: Boolean,
      default: false
    },
    unavailable: {
      type: Boolean,
      default: false
    },
    travelDetails: {
      type: String,
      default: null
    },
    travelStatus: {
      type: String,
      enum: ['available', 'on-travel', 'on-leave', 'sabbatical', 'other'],
      default: 'available'
    }
  },
  
  // ========== SIGNATURE ==========
  signature: {
    data: {
      type: String,  // Base64 image data
      default: null
    },
    capturedAt: {
      type: Date
    }
  },
  
  // ========== VERIFICATION ==========
  status: {
    type: String,
    enum: ["active", "completed", "auto-timed-out", "verified", "rejected", "pending"],
    default: "active"
  },
  remarks: {
    type: String,
    default: ''
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  verifiedAt: {
    type: Date
  },
  
  // ========== ARCHIVE/DELETE ==========
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date
  },
  archivedReason: {
    type: String,
    default: ''
  },
  
  // ========== AUTO TIME-OUT ==========
  autoTimedOutAt: {
    type: Date
  }
  
}, {
  timestamps: true,
  versionKey: "version"
});

// ========== INDEXES ==========
// For checking active time-ins (student hasn't timed out)
timeInSchema.index({ student: 1, timeOut: 1 });
// For checking classroom occupancy
timeInSchema.index({ classroom: 1, timeOut: 1 });
// For date-based queries
timeInSchema.index({ date: -1 });
// For instructor search
timeInSchema.index({ instructorName: 1 });
// For status filtering
timeInSchema.index({ status: 1 });
// For compound queries
timeInSchema.index({ student: 1, date: -1 });
timeInSchema.index({ classroom: 1, date: -1 });

// ========== VIRTUAL: Duration ==========
timeInSchema.virtual('duration').get(function() {
  if (!this.timeIn) return null;
  const end = this.timeOut || new Date();
  const diffMs = end - this.timeIn;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
});

// ========== VIRTUAL: Is Active ==========
timeInSchema.virtual('isActive').get(function() {
  return !this.timeOut;
});

// Ensure virtuals are included in JSON output
timeInSchema.set('toJSON', { virtuals: true });
timeInSchema.set('toObject', { virtuals: true });

const TimeIn = mongoose.model("TimeIn", timeInSchema);

export default TimeIn;
