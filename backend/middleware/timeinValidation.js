import { body, validationResult } from "express-validator";

// Validation for creating a time-in
export const createTimeinValidation = [
  body("classroom")
    .isMongoId()
    .withMessage("Valid classroom ID is required"),
  
  body("instructorName")
    .optional()
    .isString()
    .withMessage("Instructor name must be a string"),
  
  // ✅ NEW: Section (optional)
  body("section")
    .optional()
    .isString()
    .withMessage("Section must be a string"),
  
  // ✅ NEW: Subject Code (optional)
  body("subjectCode")
    .optional()
    .isString()
    .withMessage("Subject code must be a string"),
  
  // ✅ NEW: Class Type (in-class or no-class)
  body("classType")
    .optional()
    .isIn(["in-class", "no-class"])
    .withMessage("Class type must be either in-class or no-class"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .custom((value, { req }) => {
      if (req.body.classType === "no-class" && !String(value || "").trim()) {
        throw new Error("Reason is required when class type is no-class");
      }
      return true;
    }),

  body("customTimeIn")
    .optional()
    .isISO8601()
    .withMessage("Custom time-in must be a valid ISO 8601 date"),

  body("timeInHour")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("timeInHour must be between 1 and 12"),

  body("timeInMinute")
    .optional()
    .isInt({ min: 0, max: 59 })
    .withMessage("timeInMinute must be between 0 and 59"),

  body("timeInPeriod")
    .optional()
    .isIn(["AM", "PM"])
    .withMessage("timeInPeriod must be AM or PM"),
  
  // ✅ NEW: Scheduled Start Time (e.g., "7:30")
  body("scheduledStartTime")
    .optional()
    .isString()
    .withMessage("Scheduled start time must be a string"),
  
  // Remarks (optional)
  body("remarks")
    .optional()
    .isString()
    .withMessage("Remarks must be a string"),
  
  // ✅ NEW: Signature (optional, base64 image data)
  body("signature")
    .optional()
    .isString()
    .withMessage("Signature must be a base64 string"),
];

// Validation for verifying time-in
export const verifyTimeinValidation = [
  body("status")
    .isIn(["verified", "rejected"])
    .withMessage("Status must be verified or rejected"),
  
  body("remarks")
    .optional()
    .isString()
    .withMessage("Remarks must be a string"),
  
  // Version is required for optimistic concurrency control
  body("version")
    .optional()
    .isNumeric()
    .withMessage("Version must be a number"),
];

// Validation for time-out
export const timeoutValidation = [
  body("remarks")
    .optional()
    .isString()
    .withMessage("Remarks must be a string"),
];

// Validation for resetting old time-ins (Admin only)
export const resetOldTimeInsValidation = [
  body("hoursThreshold")
    .optional()
    .isNumeric()
    .withMessage("Hours threshold must be a number"),
  
  body("timeZone")
    .optional()
    .isString()
    .withMessage("Timezone must be a string"),
];

// Common validator middleware
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: "Validation failed",
      errors: errors.array() 
    });
  }
  next();
};