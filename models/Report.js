import mongoose from "mongoose";

const reportSchema = mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["teacher", "admin", "utilization", "daily", "weekly", "monthly", "semester"],
    required: true
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  period: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    }
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  summary: {
    totalClassrooms: Number,
    totalUtilization: Number,
    averageUtilization: Number,
    underutilizedClassrooms: Number,
    conflicts: Number,
    recommendations: [String]
  },
  status: {
    type: String,
    enum: ["generating", "completed", "failed"],
    default: "generating"
  },
  filePath: {
    type: String
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  comment: {
    type: String
  }
}, {
  timestamps: true,
  versionKey: "version"
});

const Report = mongoose.model("Report", reportSchema);

export default Report;
