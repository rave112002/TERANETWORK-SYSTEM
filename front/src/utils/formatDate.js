import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

/**
 * Format date and time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDateTime = (date) => {
  if (!date) return "—";
  return dayjs(date).format("MMM DD, YYYY HH:mm");
};

/**
 * Format date only
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  if (!date) return "—";
  return dayjs(date).format("MMM DD, YYYY");
};

/**
 * Format time only
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted time string
 */
export const formatTime = (date) => {
  if (!date) return "—";
  return dayjs(date).format("HH:mm");
};

/**
 * Get relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export const formatRelativeTime = (date) => {
  if (!date) return "—";
  return dayjs(date).fromNow();
};
