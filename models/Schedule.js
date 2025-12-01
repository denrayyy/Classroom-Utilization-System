import mongoose from "mongoose";

const scheduleSchema = mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  classroom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classroom",
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  courseCode: {
    type: String
  },
  dayOfWeek: {
    type: Number,
    min: 0,
    max: 6,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "approved", "active", "cancelled"],
    default: "pending"
  },
  semester: {
    type: String
  },
  academicYear: {
    type: String
  },
  notes: {
    type: String
  }
}, {
  timestamps: true,
  versionKey: "version"
});

const Schedule = mongoose.model("Schedule", scheduleSchema);

export default Schedule;
