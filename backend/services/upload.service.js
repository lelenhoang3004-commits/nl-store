/**
 * Upload service.
 * It manages uploaded file metadata, safe preview URLs, and file deletion without product-specific logic.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { appConfig } from "../config/app.config.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { logger } from "../utils/logger.util.js";

const UPLOAD_FOLDERS = Object.freeze({
  images: appConfig.uploadImagePath,
  files: appConfig.uploadFilePath,
  temp: appConfig.uploadTempPath
});

export class UploadService extends BaseService {
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
