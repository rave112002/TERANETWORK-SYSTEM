/**
 * Common validation patterns
 */
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^09\d{9}$/,
  url: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
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
 * Validation rules for Ant Design Form
 */
export const validationRules = {
  /**
   * Required field validation
   */
  required: (msg = "This field is required") => ({
    required: true,
    message: msg,
  }),

  /**
   * Email validation
   */
  email: (msg = "Please enter a valid email") => ({
    type: "email",
    message: msg,
  }),

  /**
   * URL validation
   */
  url: (msg = "Please enter a valid URL") => ({
    type: "url",
    message: msg,
  }),

  /**
   * Minimum length validation
   */
  minLength: (min, msg) => ({
    min,
    message: msg || `Minimum ${min} characters required`,
  }),

  /**
   * Maximum length validation
   */
  maxLength: (max, msg) => ({
    max,
    message: msg || `Maximum ${max} characters allowed`,
  }),

  /**
   * Pattern validation
   */
  pattern: (regex, msg) => ({
    pattern: regex,
    message: msg,
  }),

  /**
   * Phone number validation (Philippine format: 09XXXXXXXXX)
   */
  phone: (msg = "Phone number must be in format 09XXXXXXXXX") => ({
    pattern: patterns.phone,
    message: msg,
  }),

  /**
   * Strong password validation
   * Requirements:
   * - At least 1 lowercase letter
   * - At least 1 uppercase letter
   * - At least 1 digit
   * - At least 1 special character (!@#$%^&)(+=.-)
   * - Minimum length (default 8)
   */
  strongPassword: (min = 8) => ({
    validator: (_, value) => {
      if (!value) {
        return Promise.reject(new Error("Please input your password!"));
      }

      const errors = [];

      if (!patterns.passwordSmallLetter.test(value)) {
        errors.push("at least 1 lowercase letter");
      }

      if (!patterns.passwordCapitalLetter.test(value)) {
        errors.push("at least 1 uppercase letter");
      }

      if (!patterns.passwordNumber.test(value)) {
        errors.push("at least 1 digit");
      }

      if (!patterns.passwordSpecialChar.test(value)) {
        errors.push("at least 1 special character (!@#$%^&)(+=.-)");
      }

      if (value.length < min) {
        errors.push(`at least ${min} characters`);
      }

      if (errors.length === 0) {
        return Promise.resolve();
      } else {
        return Promise.reject(
          new Error(`Password must contain ${errors.join(", ")}`),
        );
      }
    },
  }),

  /**
   * Number range validation
   */
  numberRange: (min, max, msg) => ({
    type: "number",
    min,
    max,
    message: msg || `Value must be between ${min} and ${max}`,
  }),

  /**
   * Confirm password validation
   */
  confirmPassword: (getFieldValue, msg = "Passwords do not match") => ({
    validator: (_, value) =>
      !value || getFieldValue("password") === value
        ? Promise.resolve()
        : Promise.reject(new Error(msg)),
  }),

  /**
   * Custom validation function
   */
  custom: (fn) => ({
    validator: fn,
  }),

  /**
   * No whitespace validation
   */
  noWhitespace: (msg = "Whitespace is not allowed") => ({
    whitespace: true,
    message: msg,
  }),
};

/**
 * Combine multiple validation rules
 */
export const combineRules = (...rules) => rules.filter(Boolean);

/**
 * Check password strength and return details
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
      return "#52c41a"; // green
    case "medium":
      return "#faad14"; // orange
    case "weak":
      return "#ff4d4f"; // red
    default:
      return "#d9d9d9"; // gray
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
