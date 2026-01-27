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
 * - Verification workflow (pending -> verified/rejected)
 * - Student and classroom references
 * - Admin verification tracking
 */
const timeInSchema = mongoose.Schema({
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
  evidence: {
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    path: {
      type: String,
      required: true
    }
  },
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
  instructorName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["verified", "pending", "rejected"],
    default: "pending"
  },
  remarks: {
    type: String
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  verifiedAt: {
    type: Date
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  versionKey: "version"
});

// Index for efficient queries
timeInSchema.index({ student: 1, date: -1 });
timeInSchema.index({ classroom: 1, date: -1 });
timeInSchema.index({ status: 1 });

const TimeIn = mongoose.model("TimeIn", timeInSchema);

export default TimeIn;
