/**
 * Upload service.
 * It manages uploaded file metadata, safe preview URLs, and file deletion without product-specific logic.
 */
import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
    this.s3Client = isR2Configured() ? createR2Client() : null;
  }

  async createUploadedImagePayload(file) {
    if (!file) {
      throw new AppError("Uploaded file is required.", 422, "UPLOAD_FILE_REQUIRED");
    }

    if (!this.s3Client || !isR2Configured()) {
      throw new AppError("Cloudflare R2 upload storage is not configured.", 500, "UPLOAD_STORAGE_NOT_CONFIGURED");
    }

    const extension = normalizeImageExtension(file);
    const objectKey = createR2ObjectKey(extension);
    await this.s3Client.send(new PutObjectCommand({
      Bucket: appConfig.r2BucketName,
      Key: objectKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: "public, max-age=31536000, immutable"
    }));

    const url = createR2PublicUrl(objectKey);

    if (!isHttpsUrl(url)) {
      throw new AppError("Upload failed because storage did not return a valid HTTPS URL.", 502, "UPLOAD_STORAGE_URL_INVALID");
    }

    return {
      originalName: file.originalname,
      fileName: path.basename(objectKey),
      objectKey,
      mimeType: file.mimetype,
      size: file.size,
      folder: "images",
      extension,
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

function isR2Configured() {
  return Boolean(
    appConfig.r2AccessKeyId
    && appConfig.r2SecretAccessKey
    && appConfig.r2BucketName
    && appConfig.r2Endpoint
    && appConfig.r2PublicUrl
  );
}

function createR2Client() {
  return new S3Client({
    region: appConfig.r2Region || "auto",
    endpoint: appConfig.r2Endpoint,
    credentials: {
      accessKeyId: appConfig.r2AccessKeyId,
      secretAccessKey: appConfig.r2SecretAccessKey
    }
  });
}

function createR2ObjectKey(extension) {
  const folder = String(appConfig.r2Folder || "products").replace(/^\/+|\/+$/g, "") || "products";
  return `${folder}/${Date.now()}-${crypto.randomUUID()}${extension}`;
}

function createR2PublicUrl(objectKey) {
  return `${String(appConfig.r2PublicUrl || "").replace(/\/+$/, "")}/${objectKey}`;
}

function normalizeImageExtension(file) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(extension)) return extension;
  const mimeExtensions = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp"
  };
  return mimeExtensions[file.mimetype] || extension || ".jpg";
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
