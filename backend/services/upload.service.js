/**
 * Upload service.
 * It manages uploaded file metadata, safe preview URLs, and file deletion without product-specific logic.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { appConfig } from "../config/app.config.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { logger } from "../utils/logger.util.js";

const UPLOAD_FOLDERS = Object.freeze({
  images: appConfig.uploadImagePath,
  files: appConfig.uploadFilePath,
  temp: appConfig.uploadTempPath
});

const LEGACY_UPLOAD_LOST_MESSAGE = "Ảnh cũ đã mất, vui lòng tải lại ảnh.";

export class UploadService extends BaseService {
  constructor() {
    super();
    if (isCloudinaryConfigured()) {
      cloudinary.config({
        cloud_name: appConfig.cloudinaryCloudName,
        api_key: appConfig.cloudinaryApiKey,
        api_secret: appConfig.cloudinaryApiSecret,
        secure: true
      });
    }
  }

  async createUploadedImagePayload(file) {
    if (!file) {
      throw new AppError("Uploaded file is required.", 422, "UPLOAD_FILE_REQUIRED");
    }

    if (!isCloudinaryConfigured()) {
      throw new AppError("Cloudinary upload storage is not configured.", 500, "UPLOAD_STORAGE_NOT_CONFIGURED");
    }

    const result = await uploadBufferToCloudinary(file);
    const url = String(result.secure_url || "").trim();

    if (!isHttpsUrl(url)) {
      throw new AppError("Upload failed because storage did not return a valid HTTPS URL.", 502, "UPLOAD_STORAGE_URL_INVALID");
    }

    return {
      originalName: file.originalname,
      fileName: result.public_id,
      publicId: result.public_id,
      mimeType: file.mimetype,
      size: file.size,
      folder: "images",
      extension: path.extname(file.originalname || "").toLowerCase(),
      url
    };
  }

  async createUploadedImagesPayload(files = []) {
    const uploaded = [];
    for (const file of files) {
      uploaded.push(await this.createUploadedImagePayload(file));
    }
    return uploaded;
  }

  createUploadedFilePayload(file, folder) {
    if (!file) {
      throw new AppError("Uploaded file is required.", 422, "UPLOAD_FILE_REQUIRED");
    }

    return {
      originalName: file.originalname,
      fileName: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      folder,
      extension: path.extname(file.filename).toLowerCase(),
      url: this.createPublicUrl(folder, file.filename)
    };
  }

  createUploadedFilesPayload(files = [], folder) {
    return files.map((file) => this.createUploadedFilePayload(file, folder));
  }

  async getPreview(folder, fileName) {
    if (folder === "images") {
      throw new AppError(LEGACY_UPLOAD_LOST_MESSAGE, 404, "OLD_UPLOAD_IMAGE_LOST");
    }

    const filePath = this.resolveUploadPath(folder, fileName);
    const stats = await this.getFileStats(filePath);

    return {
      fileName,
      folder,
      size: stats.size,
      updatedAt: stats.mtime.toISOString(),
      url: this.createPublicUrl(folder, fileName)
    };
  }

  async deleteFile(folder, fileName) {
    if (folder === "images") {
      throw new AppError(LEGACY_UPLOAD_LOST_MESSAGE, 404, "OLD_UPLOAD_IMAGE_LOST");
    }

    const filePath = this.resolveUploadPath(folder, fileName);

    await this.getFileStats(filePath);
    await fs.unlink(filePath);

    logger.info("Uploaded file deleted.", {
      folder,
      fileName
    });

    return {
      fileName,
      folder,
      deleted: true
    };
  }

  createPublicUrl(folder, fileName) {
    return `/uploads/${folder}/${encodeURIComponent(fileName)}`;
  }

  resolveUploadPath(folder, fileName) {
    const folderPath = UPLOAD_FOLDERS[folder];

    if (!folderPath) {
      throw new AppError("Upload folder is invalid.", 422, "INVALID_UPLOAD_FOLDER");
    }

    const resolvedPath = path.resolve(folderPath, fileName);
    const resolvedFolder = path.resolve(folderPath);

    if (!resolvedPath.startsWith(`${resolvedFolder}${path.sep}`)) {
      throw new AppError("File path is invalid.", 422, "INVALID_FILE_PATH");
    }

    return resolvedPath;
  }

  async getFileStats(filePath) {
    try {
      return await fs.stat(filePath);
    } catch {
      throw new AppError("Uploaded file was not found.", 404, "UPLOAD_FILE_NOT_FOUND");
    }
  }
}

function isCloudinaryConfigured() {
  return Boolean(appConfig.cloudinaryCloudName && appConfig.cloudinaryApiKey && appConfig.cloudinaryApiSecret);
}

function uploadBufferToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: appConfig.cloudinaryFolder,
      resource_type: "image",
      overwrite: false,
      use_filename: true,
      unique_filename: true
    }, (error, result) => {
      if (error) return reject(error);
      return resolve(result || {});
    });

    stream.end(file.buffer);
  });
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
