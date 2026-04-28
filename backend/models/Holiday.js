import mongoose from "mongoose";

const holidaySchema = mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['regular', 'special', 'local', 'religious'],
    default: 'regular'
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isRecurring: {
    type: Boolean,
    default: true
  },
  year: {
    type: Number,
    required: true
  }
}, {
  timestamps: true,
  versionKey: "version"
});

holidaySchema.index({ date: 1 });
holidaySchema.index({ year: 1 });

const Holiday = mongoose.model("Holiday", holidaySchema);
export default Holiday;
