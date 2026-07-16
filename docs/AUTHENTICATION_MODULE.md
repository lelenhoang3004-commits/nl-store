# Authentication Module

Tài liệu này mô tả Authentication Module của backend. Module này chỉ xử lý xác thực và phân quyền, không tạo Product, không tạo User CRUD và không tạo màn hình frontend.

## Endpoint

Base path:

```text
/api/v1/auth
```

Routes:

- `POST /login`: Đăng nhập bằng email và password.
- `POST /refresh`: Cấp access token mới bằng refresh token cookie.
- `POST /logout`: Thu hồi refresh token và xóa cookie.
- `GET /me`: Kiểm tra access token hiện tại.

## Luồng Login

```text
Request
↓
validateLoginRequest
↓
AuthController.login
↓
AuthService.login
↓
AuthRepository.findByEmail
↓
bcrypt.compare
↓
JWT access token + JWT refresh token
↓
Hash refresh token
↓
AuthRepository.saveRefreshToken
↓
Response + httpOnly refresh cookie
```

## Token Strategy

- Access token là JWT ngắn hạn, trả trong response body.
- Refresh token là JWT dài hạn, lưu trong `httpOnly signed cookie`.
- Refresh token được hash bằng bcrypt trước khi lưu database.
- Khi refresh, hệ thống verify JWT rồi so sánh refresh token với hash trong database.
- Khi logout, hệ thống xóa hash refresh token và clear cookie.

## Role và Permission

Role hiện tại:

- `ADMIN`
- `STAFF`
- `CUSTOMER`
- `GUEST`

Permission được định nghĩa tập trung trong:

```text
backend/config/auth.config.js
```

Middleware dùng chung:

- `authenticate`: Kiểm tra Bearer access token.
- `authorizeRoles`: Kiểm tra role.
- `authorizePermissions`: Kiểm tra permission.

## Password Hash

Password dùng `bcrypt` với salt rounds nội bộ trong `backend/utils/password.util.js`.

Repository chỉ đọc `password_hash` để so sánh, không trả password hash ra response.

## Remember Login

Request login có thể truyền:

```json
{
  "email": "admin@example.com",
  "password": "Admin@123",
  "remember": true
}
```

Nếu `remember = true`, refresh token dùng thời hạn `JWT_REMEMBER_REFRESH_EXPIRES_IN`. Nếu không, dùng `JWT_REFRESH_EXPIRES_IN`.

## Environment Variables

```env
JWT_ACCESS_SECRET=change-this-access-secret
JWT_REFRESH_SECRET=change-this-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_REMEMBER_REFRESH_EXPIRES_IN=30d
REFRESH_COOKIE_NAME=fashion_refresh_token
REFRESH_COOKIE_PATH=/api/v1/auth
```

Trong production phải thay toàn bộ secret mặc định bằng giá trị mạnh và riêng biệt.

## Database Contract

Auth repository kỳ vọng bảng user tương lai có các cột phục vụ xác thực:

- `id`
- `email`
- `full_name`
- `avatar_url`
- `password_hash`
- `role`
- `permissions`
- `status`
- `refresh_token_hash`
- `refresh_token_expires_at`
- `last_login_at`

Tài liệu này chỉ mô tả contract. Dự án chưa tạo SQL schema trong bước này.

## File chính

- `backend/routes/auth.routes.js`
- `backend/controllers/auth.controller.js`
- `backend/services/auth.service.js`
- `backend/repositories/auth.repository.js`
- `backend/middleware/auth.middleware.js`
- `backend/validators/auth.validator.js`
- `backend/models/auth-user.model.js`
- `backend/config/auth.config.js`
- `backend/utils/jwt.util.js`
- `backend/utils/password.util.js`
- `backend/utils/token.util.js`
