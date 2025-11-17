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
  }],
  version: {
    type: Number,
    default: 1,
    min: 1
  }
}, {
  timestamps: true,
  versionKey: false
});

classroomSchema.pre("save", function setInitialVersion(next) {
  if (this.isNew && (this.version === undefined || this.version === null)) {
    this.version = 1;
  }
  next();
});

const Classroom = mongoose.model("Classroom", classroomSchema);

export default Classroom;
