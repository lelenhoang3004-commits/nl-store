/**
 * Upload controller.
 * It exposes upload, preview, and delete operations for shared media management.
 */
import { BaseController } from "./base.controller.js";
import { UploadService } from "../services/upload.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class UploadController extends BaseController {
  constructor(service = new UploadService()) {
    super();
    this.service = service;
  }

  uploadImages = asyncHandler(async (request, response) => {
    const uploadedFiles = normalizeUploadedFiles(request.files);
    if (!uploadedFiles.length) this.service.createUploadedFilePayload(null, "images");
    const files = await this.service.createUploadedImagesPayload(uploadedFiles);

    if (request.files?.image?.length) {
      return this.sendSuccess(response, files[0], "Image uploaded successfully.", 201);
    }

    return this.sendSuccess(response, {
      files
    }, "Images uploaded successfully.", 201);
  });

  uploadFile = asyncHandler(async (request, response) => {
    const file = this.service.createUploadedFilePayload(request.file, "files");

    return this.sendSuccess(response, {
      file
    }, "File uploaded successfully.", 201);
  });

  preview = asyncHandler(async (request, response) => {
    const preview = await this.service.getPreview(request.params.folder, request.params.fileName);

    return this.sendSuccess(response, {
      file: preview
    }, "File preview retrieved successfully.");
  });

  delete = asyncHandler(async (request, response) => {
    const deletedFile = await this.service.deleteFile(request.params.folder, request.params.fileName);

    return this.sendSuccess(response, {
      file: deletedFile
    }, "File deleted successfully.");
  });
}

function normalizeUploadedFiles(files) {
  if (Array.isArray(files)) return files;
  if (!files || typeof files !== "object") return [];
  return Object.values(files).flat();
}
