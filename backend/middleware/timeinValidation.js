import { body, validationResult } from "express-validator";

// Validation for creating a time-in
export const createTimeinValidation = [
  body("classroom")
    .isMongoId()
    .withMessage("Valid classroom ID is required"),
  
  body("instructorName")
    .notEmpty()
    .withMessage("Instructor name is required")
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
  
  // ✅ NEW: Class Type (synchronous or asynchronous)
  body("classType")
    .optional()
    .isIn(["synchronous", "asynchronous"])
    .withMessage("Class type must be synchronous or asynchronous"),
  
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