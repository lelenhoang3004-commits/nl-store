# Middleware Layer

Tài liệu này mô tả các middleware dùng chung của backend. Lớp middleware không chứa CRUD và không chứa nghiệp vụ module.

## Mục tiêu

- Tách từng trách nhiệm rõ ràng.
- Dễ tái sử dụng cho các route sau này.
- Giữ controller sạch, chỉ nhận request đã được kiểm tra.
- Chuẩn hóa lỗi qua `AppError` và `errorHandler`.

## Danh sách Middleware

- `authentication.middleware.js`: Xác thực Bearer access token và gắn `request.user`.
- `authorization.middleware.js`: Guard tổng hợp theo role và permission.
- `role.middleware.js`: Kiểm tra role.
- `permission.middleware.js`: Kiểm tra permission.
- `validate-request.middleware.js`: Chạy request validator.
- `validation.middleware.js`: Alias import gọn cho validation middleware.
- `upload.middleware.js`: Cấu hình Multer cho upload file và upload image.
- `error-handler.middleware.js`: Xử lý lỗi tập trung.
- `request-logger.middleware.js`: Ghi request log bằng Morgan qua logger hệ thống.
- `not-found.middleware.js`: Bắt route không tồn tại.
- `rate-limit.middleware.js`: Giới hạn request.
- `security.middleware.js`: Gắn Helmet, CORS, Compression và Rate Limit vào Express app.
- `auth.middleware.js`: File tương thích ngược, re-export các auth middleware đã tách.
- `index.js`: Barrel export cho toàn bộ middleware.

## Thứ tự Global Middleware

```text
Security
Rate Limit
Body Parser
Cookie Parser
Request Logger
Static
Routes
Not Found
Error Handler
```

## Authentication

```js
import { authenticate } from "../middleware/authentication.middleware.js";

router.get("/me", authenticate, controller.me);
```

Middleware đọc `Authorization: Bearer <accessToken>`. Nếu token hợp lệ, middleware gắn:

```js
request.user = {
  id: "1",
  role: "ADMIN",
  permissions: ["dashboard:view"]
};
```

## Authorization

Role guard:

```js
import { authorizeRoles } from "../middleware/role.middleware.js";

router.get("/admin", authenticate, authorizeRoles("ADMIN"), controller.index);
```

Permission guard:

```js
import { authorizePermissions } from "../middleware/permission.middleware.js";

router.post("/orders", authenticate, authorizePermissions("order:manage"), controller.create);
```

Combined guard:

```js
import { authorize } from "../middleware/authorization.middleware.js";

router.get(
  "/reports",
  authenticate,
  authorize({ roles: ["ADMIN", "STAFF"], permissions: ["dashboard:view"] }),
  controller.index
);
```

## Validation

```js
import { validateRequest } from "../middleware/validation.middleware.js";

router.post("/login", validateRequest(validateLoginRequest), controller.login);
```

Validator phải trả:

```js
{
  isValid: true,
  errors: []
}
```

## Upload

Upload file:

```js
import { handleUploadError, upload } from "../middleware/upload.middleware.js";

router.post("/upload", upload.single("file"), handleUploadError, controller.upload);
```

Upload image:

```js
import { handleUploadError, uploadImage } from "../middleware/upload.middleware.js";

router.post("/image", uploadImage.single("image"), handleUploadError, controller.uploadImage);
```

Các route upload chưa được tạo trong bước này. Middleware chỉ chuẩn bị nền tảng cho module upload sau này.

## Rate Limit

Rate limit dùng biến môi trường:

```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300
```

Response khi vượt giới hạn dùng API Standard:

```json
{
  "success": false,
  "statusCode": 429,
  "message": "Too many requests. Please try again later.",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "details": null
  }
}
```

## Quy ước

- Middleware không gọi repository trừ khi đó là middleware xác thực có chủ đích.
- Middleware không viết SQL.
- Middleware không chứa logic CRUD.
- Middleware chỉ xác thực, phân quyền, validate, log, upload, hoặc chuẩn hóa lỗi.
