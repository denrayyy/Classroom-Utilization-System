import SystemSetting from "../models/SystemSetting.js";

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
