import SystemSettings from "../models/SystemSettings.js";

const DEFAULT_REPORT_HEADER = {
  semester: "2nd Semester",
  academicYearStart: "2025",
  academicYearEnd: "2026",
};

const DEFAULT_NO_CLASS_REASONS = ["Travel", "Sick", "Absent", "Seminar", "Meeting"];

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
  const settings = await SystemSettings.getSettings();
  return sanitizeReportHeader(settings.reportHeader || {});
};

// ========== REPORT HEADER ==========
export const getReportHeaderSettings = async (_req, res) => {
  const reportHeader = await getStoredReportHeader();
  res.json(reportHeader);
};

export const updateReportHeaderSettings = async (req, res) => {
  const reportHeader = sanitizeReportHeader(req.body || {});
  const settings = await SystemSettings.getSettings();

  settings.reportHeader = {
    semester: reportHeader.semester,
    academicYearStart: reportHeader.academicYearStart,
    academicYearEnd: reportHeader.academicYearEnd,
  };
  settings.updatedBy = req.user._id;
  await settings.save(); // ✅ version increments properly

  res.json({
    message: "Report settings updated successfully.",
    reportHeader,
  });
};

// ========== GENERAL SETTINGS ==========
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

    await settings.save(); // ✅ version increments properly
    res.json({ message: "Settings updated", settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========== NO-CLASS REASONS ==========
export const getNoClassReasons = async (_req, res) => {
  try {
    const settings = await SystemSettings.getSettings();
    const reasons = Array.isArray(settings.noClassReasons) && settings.noClassReasons.length
      ? settings.noClassReasons
      : DEFAULT_NO_CLASS_REASONS;
    res.json(reasons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addNoClassReason = async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }

    const settings = await SystemSettings.getSettings();
    const existing = Array.isArray(settings.noClassReasons)
      ? settings.noClassReasons
      : [];

    const duplicate = existing.some(
      (item) => String(item || "").trim().toLowerCase() === reason.toLowerCase(),
    );
    if (duplicate) {
      return res.status(409).json({ message: "Reason already exists" });
    }

    settings.noClassReasons = [...existing, reason];
    settings.updatedBy = req.user._id;
    await settings.save(); // ✅ version increments properly

    res.status(201).json(settings.noClassReasons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const removeNoClassReason = async (req, res) => {
  try {
    const index = Number.parseInt(req.params.index, 10);
    if (Number.isNaN(index) || index < 0) {
      return res.status(400).json({ message: "Invalid index" });
    }

    const settings = await SystemSettings.getSettings();
    const existing = Array.isArray(settings.noClassReasons)
      ? settings.noClassReasons
      : [];

    if (index >= existing.length) {
      return res.status(404).json({ message: "Reason not found" });
    }

    const next = existing.filter((_, i) => i !== index);
    settings.noClassReasons = next.length ? next : DEFAULT_NO_CLASS_REASONS;
    settings.updatedBy = req.user._id;
    await settings.save(); // ✅ version increments properly

    res.json(settings.noClassReasons);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};