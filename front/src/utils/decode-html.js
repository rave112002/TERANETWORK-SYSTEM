/**
 * Decode HTML entities in a string
 * @param {string} html - HTML string to decode
 * @returns {string} Decoded string
 */
export const decodeHTML = (str) => {
  if (str == null) return "";
  if (typeof str !== "string") str = String(str);

  const textarea = document.createElement("textarea");

  let prev;
  let next = str;

  do {
    prev = next;
    textarea.innerHTML = prev;
    next = textarea.value;
  } while (next !== prev);

  return next;
};
