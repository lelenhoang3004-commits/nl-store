# User Module

Tài liệu này mô tả User Module của backend. Module này tuân thủ MVC, Repository Pattern, Service Layer, Validation, Middleware và RESTful convention hiện tại. Module không chứa Dashboard logic.

## Base Path

```text
/api/v1/users
```

## Endpoint

Profile:

- `GET /profile`: Lấy profile của user đang đăng nhập.
- `PUT /profile`: Cập nhật profile, avatar URL và address của user đang đăng nhập.
- `POST /profile/avatar`: Upload avatar, field name là `avatar`.

Admin CRUD:

- `GET /`: Lấy danh sách user.
- `GET /:id`: Lấy chi tiết user.
- `POST /`: Tạo user.
- `PUT /:id`: Cập nhật user.
- `DELETE /:id`: Soft delete user.

Tất cả endpoint đều yêu cầu:

```text
Authorization: Bearer <accessToken>
```

## Permission

- Xem user: `user:view`.
- Tạo, sửa, xóa user: `user:manage`.
- Profile endpoints chỉ yêu cầu đăng nhập.

## Request Flow

```text
Request
↓
Route
↓
Authentication Middleware
↓
Permission Middleware
↓
Validation Middleware
↓
User Controller
↓
User Service
↓
User Repository
↓
MySQL
↓
Response
```

## Query List

```text
GET /api/v1/users?page=1&limit=10&search=admin&role=ADMIN&status=active&sortBy=createdAt&sortOrder=desc
```

Hỗ trợ:

- `page`
- `limit`
- `search`
- `role`
- `status`
- `sortBy`
- `sortOrder`

Sort fields được whitelist:

- `createdAt`
- `updatedAt`
- `fullName`
- `email`
- `role`
- `status`
- `lastLoginAt`

## Body

Create body:

```json
{
  "email": "admin@example.com",
  "password": "Admin@123",
  "fullName": "Admin Fashion",
  "phone": "0901234567",
  "avatarUrl": "/uploads/images/avatar.webp",
  "role": "ADMIN",
  "permissions": ["user:view", "user:manage"],
  "status": "active",
  "address": {
    "line1": "123 Nguyen Hue",
    "line2": "Floor 2",
    "ward": "Ben Nghe",
    "district": "District 1",
    "city": "Ho Chi Minh City",
    "province": "Ho Chi Minh",
    "country": "Vietnam",
    "postalCode": "700000"
  }
}
```

Update body giống create, nhưng `password` là optional. Nếu không truyền password thì hệ thống giữ password hiện tại.

## Role và Permission

Role hợp lệ:

- `ADMIN`
- `STAFF`
- `CUSTOMER`
- `GUEST`

Permission hợp lệ được định nghĩa trong:

```text
backend/config/auth.config.js
```

Nếu không truyền `permissions`, service sẽ lấy permission mặc định theo role.

## Avatar

Upload avatar:

```text
POST /api/v1/users/profile/avatar
```

Field name:

```text
avatar
```

Avatar dùng chung `uploadImage` middleware và `UploadService`, không viết lại Multer.

## Address

Address được lưu dạng JSON trong cột `address_json`. Cách này giữ module đơn giản, dễ dùng ngay, và sau này có thể tách sang bảng `user_addresses` nếu cần nhiều địa chỉ.

## Database Contract

Repository kỳ vọng bảng `users` có các cột:

- `id`
- `email`
- `full_name`
- `phone`
- `avatar_url`
- `password_hash`
- `role`
- `permissions`
- `status`
- `address_json`
- `refresh_token_hash`
- `refresh_token_expires_at`
- `last_login_at`
- `created_at`
- `updated_at`
- `deleted_at`

Module dùng soft delete bằng `deleted_at`, đồng thời xóa refresh token khi user bị xóa.

## File chính

- `backend/models/user.model.js`
- `backend/repositories/user.repository.js`
- `backend/services/user.service.js`
- `backend/controllers/user.controller.js`
- `backend/routes/user.routes.js`
- `backend/validators/user.validator.js`

## Quy ước

- SQL chỉ nằm trong repository.
- Business rule nằm trong service.
- Controller chỉ xử lý HTTP request/response.
- Validator kiểm tra input trước controller.
- Route dùng authentication và permission middleware.
- Password luôn được hash bằng bcrypt.
- Không trả `password_hash`, `refresh_token_hash` hoặc dữ liệu nhạy cảm ra API.
- Không chứa Dashboard logic.
