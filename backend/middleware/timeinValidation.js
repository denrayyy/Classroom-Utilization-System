import { body, validationResult } from "express-validator";

// Validation for creating a time-in
export const createTimeinValidation = [
  body("classroom").isMongoId().withMessage("Valid classroom ID is required"),
  body("instructorName").notEmpty().withMessage("Instructor name is required"),
  body("remarks").optional().isString(),
];

// Validation for verifying time-in
export const verifyTimeinValidation = [
  body("status").isIn(["verified", "rejected"]).withMessage("Status must be verified or rejected"),
  body("remarks").optional().isString(),
];

// Common validator middleware
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};
