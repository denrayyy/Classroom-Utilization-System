import mongoose from "mongoose";

const systemSettingsSchema = mongoose.Schema(
  {
    documentCode: { type: String, default: "OVPAA-F-INS-068" },
    revisionNo: { type: Number, default: 0 },
    issueDate: { type: Date, default: () => new Date("2024-10-09") },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Only one settings document should exist
systemSettingsSchema.statics.getSettings = async function getSettings() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export default mongoose.model("SystemSettings", systemSettingsSchema);
