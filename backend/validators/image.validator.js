/**
 * Image validator.
 * It validates Multer-like file objects without performing upload or storage work.
 */
import path from "node:path";
import { createValidationError, createValidationResult, isEmpty, validateRequired } from "./base.validator.js";

const DEFAULT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function validateImage(file, options = {}) {
  const field = options.field || "image";
  const location = options.location || "file";
  const allowedMimeTypes = options.allowedMimeTypes || DEFAULT_IMAGE_MIME_TYPES;
  const allowedExtensions = options.allowedExtensions || DEFAULT_IMAGE_EXTENSIONS;
  const maxSizeBytes = options.maxSizeBytes || DEFAULT_MAX_SIZE_BYTES;
  const errors = [];

  if (options.required) {
    const requiredError = validateRequired(file, field, location);

    if (requiredError) {
      errors.push(requiredError);
      return createValidationResult(errors);
    }
  }

  if (isEmpty(file)) {
    return createValidationResult(errors);
  }

  const extension = path.extname(file.originalname || "").toLowerCase();

  if (!allowedMimeTypes.includes(file.mimetype)) {
    errors.push(createValidationError(field, `${field} must be a supported image type.`, location, "INVALID_IMAGE_TYPE"));
  }

  if (!allowedExtensions.includes(extension)) {
    errors.push(createValidationError(field, `${field} must use a supported image extension.`, location, "INVALID_IMAGE_EXTENSION"));
  }

  if (Number(file.size || 0) > maxSizeBytes) {
    errors.push(createValidationError(field, `${field} must not exceed ${maxSizeBytes} bytes.`, location, "IMAGE_TOO_LARGE"));
  }

  return createValidationResult(errors);
}
