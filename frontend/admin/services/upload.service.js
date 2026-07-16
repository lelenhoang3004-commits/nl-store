import { apiClient } from "./api/index.js";

// Upload service is the only frontend entrypoint for file transfer requests.
class UploadService {
  uploadProductImage(file, options = {}) {
    const formData = new FormData();
    formData.append("image", file);
    return apiClient.upload("/uploads/images", formData, options);
  }

  uploadImages(files, options = {}) {
    const formData = this.createFilesFormData(files, "images");
    return apiClient.upload("/uploads/images", formData, options);
  }

  uploadFiles(files, options = {}) {
    const formData = this.createFilesFormData(files, "files");
    return apiClient.upload("/uploads/files", formData, options);
  }

  getPreview(folder, fileName, options = {}) {
    return apiClient.get(`/uploads/preview/${folder}/${fileName}`, options);
  }

  removeFile(folder, fileName, options = {}) {
    return apiClient.delete(`/uploads/${folder}/${fileName}`, options);
  }

  createFilesFormData(files, fieldName) {
    const formData = new FormData();
    const fileList = Array.isArray(files) ? files : Array.from(files ?? []);

    fileList.forEach((file) => {
      formData.append(fieldName, file);
    });

    return formData;
  }
}

export const uploadService = new UploadService();
export { UploadService };
