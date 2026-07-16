/**
 * Upload middleware.
 * It centralizes Multer configuration for future image and file uploads.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { appConfig } from "../config/app.config.js";
import { AppError } from "../utils/app-error.util.js";

const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_FILE_EXTENSIONS = [".pdf", ".txt", ".csv", ".xlsx"];

ensureUploadFolders();

const fileStorage = multer.diskStorage({
  destination(request, file, callback) {
    callback(null, appConfig.uploadFilePath);
  },
  filename(request, file, callback) {
    callback(null, createSafeFileName(file));
  }
});

const imageStorage = multer.diskStorage({
  destination(request, file, callback) {
    callback(null, appConfig.uploadImagePath);
  },
  filename(request, file, callback) {
    callback(null, createSafeFileName(file));
  }
});

export const upload = multer({
  storage: fileStorage,
  limits: {
    fileSize: appConfig.uploadMaxFileSize
  },
  fileFilter(request, file, callback) {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (!appConfig.uploadAllowedFileTypes.includes(file.mimetype)) {
      return callback(new AppError("File type is not allowed.", 422, "INVALID_FILE_TYPE"));
    }

    if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
      return callback(new AppError("File extension is not allowed.", 422, "INVALID_FILE_EXTENSION"));
    }

    return callback(null, true);
  }
});

export const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: appConfig.uploadImageMaxFileSize
  },
  fileFilter(request, file, callback) {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (!appConfig.uploadAllowedImageTypes.includes(file.mimetype)) {
      return callback(new AppError("Only JPEG, PNG, and WEBP images are allowed.", 422, "INVALID_IMAGE_TYPE"));
    }

    if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
      return callback(new AppError("Image extension is not allowed.", 422, "INVALID_IMAGE_EXTENSION"));
    }

    return callback(null, true);
  }
});

export function handleUploadError(error, request, response, next) {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("Image size is too large.", 413, "IMAGE_TOO_LARGE"));
    }
    return next(new AppError(error.message, 422, error.code));
  }

  return next(error);
}

export async function validateUploadedImages(request, response, next) {
  try {
    const files = normalizeUploadedFiles(request.files);

    for (const file of files) {
      if (!await hasValidImageSignature(file)) {
        await removeUploadedFile(file);
        return next(new AppError("Image content does not match an allowed image format.", 422, "INVALID_IMAGE_SIGNATURE"));
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

export async function validateUploadedFiles(request, response, next) {
  try {
    const files = normalizeUploadedFiles(request.file ?? request.files);

    for (const file of files) {
      if (!await hasValidDocumentSignature(file)) {
        await removeUploadedFile(file);
        return next(new AppError("File content does not match its extension.", 422, "INVALID_FILE_SIGNATURE"));
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

function createSafeFileName(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const baseName = path.basename(file.originalname || "upload", extension)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50) || "upload";

  return `${baseName}-${Date.now()}-${crypto.randomUUID()}${extension}`;
}

function ensureUploadFolders() {
  [
    appConfig.uploadPath,
    appConfig.uploadImagePath,
    appConfig.uploadFilePath,
    appConfig.uploadTempPath
  ].forEach((folderPath) => {
    fs.mkdirSync(folderPath, { recursive: true });
  });
}

function normalizeUploadedFiles(files) {
  if (!files) {
    return [];
  }

  if (Array.isArray(files)) {
    return files;
  }

  if (typeof files === "object" && files.path) {
    return [files];
  }

  return Object.values(files).flat();
}

async function hasValidImageSignature(file) {
  const signature = await readFileSignature(file.path, 12);
  const hex = signature.toString("hex");
  const ascii = signature.toString("ascii");

  if (file.mimetype === "image/jpeg") {
    return hex.startsWith("ffd8ff");
  }

  if (file.mimetype === "image/png") {
    return hex.startsWith("89504e470d0a1a0a");
  }

  if (file.mimetype === "image/webp") {
    return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  }

  return false;
}

async function hasValidDocumentSignature(file) {
  const extension = path.extname(file.originalname || file.filename || "").toLowerCase();
  const signature = await readFileSignature(file.path, 8);
  const hex = signature.toString("hex");

  if (extension === ".pdf") {
    return signature.toString("ascii", 0, 4) === "%PDF";
  }

  if (extension === ".xlsx") {
    return hex.startsWith("504b0304");
  }

  return [".txt", ".csv"].includes(extension);
}

async function readFileSignature(filePath, length) {
  const handle = await fs.promises.open(filePath, "r");
  const buffer = Buffer.alloc(length);

  try {
    const { bytesRead } = await handle.read(buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function removeUploadedFile(file) {
  if (file?.path) {
    await fs.promises.rm(file.path, { force: true });
  }
}
