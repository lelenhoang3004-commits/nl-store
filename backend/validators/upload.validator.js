/**
 * Upload validators.
 * They validate upload route params and prevent unsafe file path input.
 */
import { createValidationError, createValidationResult, mergeValidationResults, validateRequired } from "./base.validator.js";

const ALLOWED_UPLOAD_FOLDERS = ["images", "files", "temp"];
const SAFE_FILE_NAME_REGEX = /^[a-z0-9][a-z0-9._-]*$/i;

export function validateUploadParams({ params }) {
  return mergeValidationResults([
    validateUploadFolder(params.folder),
    validateUploadFileName(params.fileName)
  ]);
}

export function validateUploadFolder(folder) {
  const errors = [];
  const requiredError = validateRequired(folder, "folder", "params");

  if (requiredError) {
    errors.push(requiredError);
    return createValidationResult(errors);
  }

  if (!ALLOWED_UPLOAD_FOLDERS.includes(folder)) {
    errors.push(createValidationError("folder", "folder must be one of: images, files, temp.", "params", "INVALID_UPLOAD_FOLDER"));
  }

  return createValidationResult(errors);
}

export function validateUploadFileName(fileName) {
  const errors = [];
  const requiredError = validateRequired(fileName, "fileName", "params");

  if (requiredError) {
    errors.push(requiredError);
    return createValidationResult(errors);
  }

  if (!SAFE_FILE_NAME_REGEX.test(fileName) || fileName.includes("..")) {
    errors.push(createValidationError("fileName", "fileName is invalid.", "params", "INVALID_FILE_NAME"));
  }

  return createValidationResult(errors);
}
