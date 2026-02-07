import { body, validationResult } from "express-validator";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// POST /api/instructors
export const createInstructorValidation = [
  body("name").notEmpty().trim().withMessage("Instructor name is required"),
];
