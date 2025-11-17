import mongoose from "mongoose";

const instructorSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  }
}, {
  timestamps: true
});

const Instructor = mongoose.model("Instructor", instructorSchema);

export default Instructor;

