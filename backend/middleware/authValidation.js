import { body, validationResult } from "express-validator";

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// POST /register
export const registerValidation = [
  body("firstName").notEmpty().withMessage("First name is required"),
  body("lastName").notEmpty().withMessage("Last name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("employeeId").optional().notEmpty().withMessage("Employee ID cannot be empty if provided"),
];

// POST /login
export const loginValidation = (recaptchaKey) => [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
  body("recaptchaToken").custom((value) => {
    if (!recaptchaKey) return true;
    if (!value) throw new Error("reCAPTCHA token is required");
    return true;
  }),
];

// POST /forgot
export const forgotPasswordValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
];

// POST /verify-code
export const verifyCodeValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("code").notEmpty().withMessage("Verification code is required"),
];

// POST /reset
export const resetPasswordValidation = [
  body("resetToken").notEmpty().withMessage("Reset token is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

// PUT /profile
export const updateProfileValidation = [
  body("firstName").optional().notEmpty().withMessage("First name cannot be empty"),
  body("lastName").optional().notEmpty().withMessage("Last name cannot be empty"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("phone").optional().isString(),
];

// POST /change-password
export const changePasswordValidation = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
];
