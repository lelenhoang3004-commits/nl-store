# Upload Manager

Tài liệu này mô tả Upload Manager của backend. Module này chỉ quản lý file upload dùng chung, không thuộc Product và không triển khai CRUD nghiệp vụ.

## Mục tiêu

- Upload ảnh bằng Multer.
- Upload file dùng chung.
- Rename file an toàn.
- Validate MIME type, extension và dung lượng.
- Tách folder rõ ràng.
- Preview bằng public URL.
- Delete file an toàn.
- Chuẩn hóa lỗi qua `AppError` và `errorHandler`.

## Folder Structure

```text
backend/uploads/
├── images/
├── files/
└── temp/
```

Ý nghĩa:

- `images/`: Ảnh hợp lệ như JPG, PNG, WebP.
- `files/`: File dùng chung không gắn với module nghiệp vụ.
- `temp/`: Vùng tạm cho xử lý upload sau này.

## Endpoint

Base path:

```text
/api/v1/uploads
```

Routes:

- `POST /images`: Upload nhiều ảnh, field name là `images`.
- `POST /files`: Upload một file, field name là `file`.
- `GET /preview/:folder/:fileName`: Lấy metadata và public URL của file.
- `DELETE /:folder/:fileName`: Xóa file khỏi thư mục upload.

Tất cả route đều dùng `authenticate`, nên cần `Authorization: Bearer <accessToken>`.

## Rename File

Tên file được tạo theo format:

```text
safe-original-name-timestamp-uuid.ext
```

Ví dụ:

```text
summer-shirt-1720260000000-550e8400-e29b-41d4-a716-446655440000.webp
```

Mục đích:

- Tránh trùng tên file.
- Tránh ký tự nguy hiểm.
- Giữ extension hợp lệ.
- Dễ debug khi cần.

## Validate File

Image upload kiểm tra:

- MIME type nằm trong `UPLOAD_ALLOWED_IMAGE_TYPES`.
- Extension nằm trong `.jpg`, `.jpeg`, `.png`, `.webp`.
- Size không vượt `UPLOAD_IMAGE_MAX_FILE_SIZE`.

File upload kiểm tra:

- Size không vượt `UPLOAD_MAX_FILE_SIZE`.

## Environment Variables

```env
UPLOAD_MAX_FILE_SIZE=5242880
UPLOAD_IMAGE_MAX_FILE_SIZE=5242880
UPLOAD_ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp
```

## Preview

Preview không đọc nội dung file vào response. API chỉ trả metadata và URL public:

```json
{
  "file": {
    "fileName": "image.webp",
    "folder": "images",
    "size": 120000,
    "updatedAt": "2026-07-06T11:00:00.000Z",
    "url": "/uploads/images/image.webp"
  }
}
```

File thực tế được phục vụ bởi static route:

```text
/uploads/images/:fileName
```

## Delete File

Delete chỉ cho phép xóa file trong các folder whitelist:

- `images`
- `files`
- `temp`

Service dùng `path.resolve` để chống path traversal như `../`.

## File chính

- `backend/middleware/upload.middleware.js`: Multer storage, rename, validate file, upload error handling.
- `backend/services/upload.service.js`: Tạo payload, preview metadata, delete file an toàn.
- `backend/controllers/upload.controller.js`: HTTP layer cho upload manager.
- `backend/routes/upload.routes.js`: Route upload độc lập.
- `backend/validators/upload.validator.js`: Validate folder và fileName.

## Quy ước

- Upload Manager không biết Product, Category hoặc module nghiệp vụ nào.
- Không lưu metadata vào MySQL trong bước này.
- Không viết SQL.
- Không xử lý resize/compress ảnh trong bước này vì chưa thêm package xử lý ảnh.
- Module nghiệp vụ sau này chỉ nhận URL/fileName từ Upload Manager.
