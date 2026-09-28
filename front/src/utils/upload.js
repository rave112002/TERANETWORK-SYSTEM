/**
 * Upload utility helpers (no API calls — those live in services/api/upload.js)
 */

/**
 * Get the URL of an uploaded file from its server path.
 *
 * Same-origin on purpose: in production Express serves the app and /public on
 * one port, and in development Vite proxies /public/uploads to the API. A host
 * baked in at build time would break the moment the app is opened from any
 * other address (e.g. over Tailscale).
 * @param {string} path - The file path (e.g., "/public/uploads/logos/abc.jpg")
 * @returns {string|null} URL to the file
 */
export const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("data:")) return path;
  return path.startsWith("/") ? path : `/${path}`;
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
