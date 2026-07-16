/**
 * Multer upload configuration.
 * This file centralizes image upload limits, allowed types, and storage folders.
 */
import { appConfig } from "./app.config.js";

export const multerConfig = Object.freeze({
  imagePath: appConfig.uploadImagePath,
  filePath: appConfig.uploadFilePath,
  tempPath: appConfig.uploadTempPath,
  maxImageSize: appConfig.uploadImageMaxFileSize,
  maxFileSize: appConfig.uploadMaxFileSize,
  allowedImageTypes: appConfig.uploadAllowedImageTypes,
  allowedFileTypes: appConfig.uploadAllowedFileTypes,
  allowedImageExtensions: [".jpg", ".jpeg", ".png", ".webp"],
  allowedFileExtensions: [".pdf", ".txt", ".csv", ".xlsx"]
});
