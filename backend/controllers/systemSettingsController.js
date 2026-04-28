import SystemSetting from "../models/SystemSetting.js";
import SystemSettings from "../models/SystemSettings.js";

const REPORT_HEADER_KEY = "report_header";
const DEFAULT_REPORT_HEADER = {
  semester: "2nd Semester",
  academicYearStart: "2025",
  academicYearEnd: "2026",
};

const sanitizeReportHeader = (value = {}) => {
  const semester = String(
    value.semester || DEFAULT_REPORT_HEADER.semester,
  ).trim();
  const academicYearStart = String(
    value.academicYearStart || DEFAULT_REPORT_HEADER.academicYearStart,
  ).trim();
  const academicYearEnd = String(
    value.academicYearEnd || DEFAULT_REPORT_HEADER.academicYearEnd,
  ).trim();

  return {
    semester,
    academicYearStart,
    academicYearEnd,
    label: `${semester} AY: ${academicYearStart} - ${academicYearEnd}`,
  };
};

export const getStoredReportHeader = async () => {
  const setting = await SystemSetting.findOne({ key: REPORT_HEADER_KEY }).lean();
  return sanitizeReportHeader(setting?.value);
};

export const getReportHeaderSettings = async (_req, res) => {
  const reportHeader = await getStoredReportHeader();
  res.json(reportHeader);
};

export const updateReportHeaderSettings = async (req, res) => {
  const reportHeader = sanitizeReportHeader(req.body || {});

  await SystemSetting.findOneAndUpdate(
    { key: REPORT_HEADER_KEY },
    {
      key: REPORT_HEADER_KEY,
      value: {
        semester: reportHeader.semester,
        academicYearStart: reportHeader.academicYearStart,
        academicYearEnd: reportHeader.academicYearEnd,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  res.json({
    message: "Report settings updated successfully.",
    reportHeader,
  });
};

export const getSettings = async (_req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { documentCode, revisionNo, issueDate } = req.body;
    const settings = await SystemSettings.getSettings();

    if (documentCode) settings.documentCode = documentCode;
    if (revisionNo !== undefined) settings.revisionNo = revisionNo;
    if (issueDate) settings.issueDate = new Date(issueDate);
    settings.updatedBy = req.user._id;

    await settings.save();
    res.json({ message: "Settings updated", settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
