import { z } from "zod";

/**
 * Common validation patterns
 */
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Canonical PH mobile: 11 digits grouped 4-4-3 (e.g. 0912 3456 789)
  phone: /^09\d{2} \d{4} \d{3}$/,
  url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphabetic: /^[a-zA-Z]+$/,
  numeric: /^\d+$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  creditCard: /^\d{4}\s?\d{4}\s?\d{4}\s?\d{4}$/,
  passwordSmallLetter: /[a-z]/,
  passwordCapitalLetter: /[A-Z]/,
  passwordNumber: /[0-9]/,
  passwordSpecialChar: /[!@#$%^&)(+=.-]/,
  passwordLength: /.{8,}/,
};

/**
 * Strong-password zod validator. Requirements: at least 1 lowercase, 1
 * uppercase, 1 digit, 1 special char (!@#$%^&)(+=.-), and `min` length
 * (default 8). Errors aggregate into a single message.
 */
export const zStrongPassword = (min = 8) =>
  z.string().superRefine((value, ctx) => {
    if (!value) {
      ctx.addIssue({ code: "custom", message: "Please input your password!" });
      return;
    }
    const errors = [];
    if (!patterns.passwordSmallLetter.test(value))
      errors.push("at least 1 lowercase letter");
    if (!patterns.passwordCapitalLetter.test(value))
      errors.push("at least 1 uppercase letter");
    if (!patterns.passwordNumber.test(value)) errors.push("at least 1 digit");
    if (!patterns.passwordSpecialChar.test(value))
      errors.push("at least 1 special character (!@#$%^&)(+=.-)");
    if (value.length < min) errors.push(`at least ${min} characters`);
    if (errors.length)
      ctx.addIssue({
        code: "custom",
        message: `Password must contain ${errors.join(", ")}`,
      });
  });

/**
 * Check password strength and return details (drives PasswordStrengthIndicator).
 */
export const checkPasswordStrength = (password) => {
  if (!password) {
    return {
      strength: "none",
      score: 0,
      requirements: {
        hasLowercase: false,
        hasUppercase: false,
        hasNumber: false,
        hasSpecialChar: false,
        hasMinLength: false,
      },
      message: "Enter a password",
    };
  }

  const requirements = {
    hasLowercase: patterns.passwordSmallLetter.test(password),
    hasUppercase: patterns.passwordCapitalLetter.test(password),
    hasNumber: patterns.passwordNumber.test(password),
    hasSpecialChar: patterns.passwordSpecialChar.test(password),
    hasMinLength: password.length >= 8,
  };

  const score = Object.values(requirements).filter(Boolean).length;

  let strength = "weak";
  let message = "Weak password";

  if (score === 5) {
    strength = "strong";
    message = "Strong password";
  } else if (score >= 3) {
    strength = "medium";
    message = "Medium password";
  }

  return {
    strength,
    score,
    requirements,
    message,
  };
};

/**
 * Get password strength color
 */
export const getPasswordStrengthColor = (strength) => {
  switch (strength) {
    case "strong":
      return "var(--color-success)";
    case "medium":
      return "var(--color-warning)";
    case "weak":
      return "var(--color-error)";
    default:
      return "var(--color-text-muted)";
  }
};

/**
 * Password requirements list for display
 */
export const passwordRequirements = [
  { key: "hasLowercase", label: "At least 1 lowercase letter (a-z)" },
  { key: "hasUppercase", label: "At least 1 uppercase letter (A-Z)" },
  { key: "hasNumber", label: "At least 1 number (0-9)" },
  {
    key: "hasSpecialChar",
    label: "At least 1 special character (!@#$%^&)(+=.-)",
  },
  { key: "hasMinLength", label: "At least 8 characters long" },
];
