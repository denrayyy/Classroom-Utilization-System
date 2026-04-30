/**
 * Derive a report-friendly remarks string from classType and reason.
 * We intentionally do NOT overwrite existing remarks when they are already set.
 */
export function deriveRemarks({ classType, reason } = {}) {
  const normalized = String(classType || "").trim().toLowerCase();
  if (normalized === "no-class") {
    const r = String(reason || "").trim();
    return r ? `No class - ${r}` : "No class";
  }
  // Default to in-class for unknown/empty values
  return "In class";
}

