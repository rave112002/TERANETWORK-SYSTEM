import { patterns } from "./validation";

/**
 * Format phone number to 09XXXXXXXXX format
 * Handles various input formats:
 * - +639XXXXXXXXX → 09XXXXXXXXX
 * - 639XXXXXXXXX → 09XXXXXXXXX
 * - 9XXXXXXXXX → 09XXXXXXXXX
 * - 09XXXXXXXXX → 09XXXXXXXXX (no change)
 * - Removes spaces, dashes, parentheses
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return "";

  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");

  // Handle different formats
  if (cleaned.startsWith("63")) {
    // +63 or 63 format
    cleaned = "0" + cleaned.substring(2);
  } else if (cleaned.startsWith("9") && cleaned.length === 10) {
    // 9XXXXXXXXX format
    cleaned = "0" + cleaned;
  } else if (cleaned.startsWith("09") && cleaned.length === 11) {
    // Already in correct format
    return cleaned;
  }

  // Validate length (should be 11 digits: 09XXXXXXXXX)
  if (cleaned.length !== 11 || !cleaned.startsWith("09")) {
    return phone; // Return original if invalid
  }

  return cleaned;
};

/**
 * Validate Philippine mobile number format
 * Must be 09XXXXXXXXX (11 digits starting with 09)
 */
export const isValidPhoneNumber = (phone) => {
  if (!phone) return false;

  const cleaned = phone.replace(/\D/g, "");
  return patterns.phone.test(cleaned);
};

/**
 * Format phone number for display with spacing
 * 09XXXXXXXXX → 09XX XXX XXXX
 */
export const formatPhoneDisplay = (phone) => {
  const cleaned = formatPhoneNumber(phone);

  if (cleaned.length !== 11) return phone;

  return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
};

/**
 * Custom validator for Ant Design Form
 */
export const phoneValidator = (_, value) => {
  if (!value) {
    return Promise.reject(new Error("Phone number is required"));
  }

  const formatted = formatPhoneNumber(value);

  if (!isValidPhoneNumber(formatted)) {
    return Promise.reject(
      new Error("Phone number must be in format 09XXXXXXXXX (11 digits)"),
    );
  }

  return Promise.resolve();
};

/**
 * Input handler for real-time formatting
 * Use with onChange event
 */
export const handlePhoneInput = (e, form, fieldName) => {
  const value = e.target.value;
  const formatted = formatPhoneNumber(value);

  if (formatted !== value) {
    form.setFieldsValue({ [fieldName]: formatted });
  }
};
