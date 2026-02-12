import mongoose from "mongoose";

const classroomSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  capacity: {
    type: Number,
    required: false
  },
  location: {
    type: String,
    required: true
  },
  equipment: [{
    type: String
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  isArchived: {
  type: Boolean,
  default: false,
  index: true
  },
  description: {
    type: String
  },
  schedules: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    time: {
      type: String
    },
    section: {
      type: String
    },
    subjectCode: {
      type: String
    },
    instructor: {
      type: String
    }
  }]
}, {
  timestamps: true,
  versionKey: "version"
});

const Classroom = mongoose.model("Classroom", classroomSchema);

export default Classroom;
