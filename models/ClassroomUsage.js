import mongoose from "mongoose";

const classroomUsageSchema = mongoose.Schema({
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  schedule: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Schedule"
  },
  date: {
    type: Date,
    required: true
  },
  timeIn: {
    type: Date,
    required: true
  },
  timeOut: {
    type: Date
  },
  status: {
    type: String,
    enum: ["on-time", "late-start", "early-end", "no-show"],
    default: "on-time"
  },
  utilizationRate: {
    type: Number,
    min: 0,
    max: 100
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

const ClassroomUsage = mongoose.model("ClassroomUsage", classroomUsageSchema);

export default ClassroomUsage;
