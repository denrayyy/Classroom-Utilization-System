import mongoose from "mongoose";

const instructorSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  archived: {
    type: Boolean,
    default: false
  },
  unavailable: {
    type: Boolean,
    default: false
  },
  unavailableReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

const Instructor = mongoose.model("Instructor", instructorSchema);

export default Instructor;

