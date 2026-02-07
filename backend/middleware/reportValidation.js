import { body, validationResult } from "express-validator";

// Common validator middleware
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// POST /teacher
export const teacherReportValidation = [
  body("startDate").isISO8601().withMessage("Valid start date is required"),
  body("endDate").isISO8601().withMessage("Valid end date is required"),
  body("title").optional().isString(),
];

// POST /admin
export const adminReportValidation = [
  body("startDate").isISO8601().withMessage("Valid start date is required"),
  body("endDate").isISO8601().withMessage("Valid end date is required"),
  body("title").optional().isString(),
];

// POST /weekly
export const weeklyReportValidation = [
  body("startDate").isISO8601().withMessage("Valid start date is required"),
];

// POST /:id/share
export const shareReportValidation = [
  body("userIds").isArray().withMessage("User IDs array is required"),
  body("userIds.*").isMongoId().withMessage("Valid user ID is required"),
];

// PUT /:id/comment
export const commentReportValidation = [
  body("comment").optional().isString(),
];
