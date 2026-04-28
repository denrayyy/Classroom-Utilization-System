import mongoose from "mongoose";

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: "version",
  },
);

const SystemSetting = mongoose.model("SystemSetting", systemSettingSchema);

export default SystemSetting;
