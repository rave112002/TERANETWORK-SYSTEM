/**
 * Upload utility helpers (no API calls — those live in services/api/upload.js)
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

/**
 * Get full image URL from a server path
 * @param {string} path - The file path (e.g., "/public/uploads/logos/abc.jpg")
 * @returns {string|null} Full URL to the image
 */
export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("data:")) return path;
  return `${API_URL}${path}`;
};

/**
 * Validate image file (type + size)
 * @param {File} file - The file to validate
 * @param {Object} options - Validation options
 * @returns {Object} { valid: boolean, error?: string }
 */
export const validateImageFile = (file, options = {}) => {
  const {
    maxSizeMB = 5,
    allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"],
  } = options;

  const maxSize = maxSizeMB * 1024 * 1024;

  if (!file) {
    return { valid: false, error: "No file provided" };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type must be one of: ${allowedTypes.map((t) => t.replace("image/", "")).join(", ")}`,
    };
  }

  return { valid: true };
};

/**
 * Convert file to base64 (for preview)
 * @param {File} file - The file to convert
 * @returns {Promise<string>} Base64 data URL string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
