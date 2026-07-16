/**
 * Request sanitization middleware.
 * It removes prototype-pollution keys and trims string input before validation and controllers run.
 */
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function sanitizeRequest(request, response, next) {
  sanitizeObject(request.body);
  sanitizeObject(request.query);
  sanitizeObject(request.params);
  return next();
}

function sanitizeObject(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      value[index] = sanitizeObject(item);
    });
    return value;
  }

  Object.keys(value).forEach((key) => {
    if (BLOCKED_KEYS.has(key)) {
      delete value[key];
      return;
    }

    if (typeof value[key] === "string") {
      value[key] = value[key].trim();
      return;
    }

    value[key] = sanitizeObject(value[key]);
  });

  return value;
}
