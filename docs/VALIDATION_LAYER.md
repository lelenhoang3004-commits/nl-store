# Validation Layer

Tài liệu này mô tả lớp validation dùng chung cho backend. Lớp này không tạo API, không CRUD và không truy cập database.

## Mục tiêu

- Tách validation khỏi controller và service.
- Chuẩn hóa format lỗi cho toàn bộ hệ thống.
- Cho phép mỗi module ghép nhiều validator nhỏ thay vì viết lại logic.
- Chuẩn bị sẵn cho REST API, upload ảnh và phân trang sau này.

## Cấu trúc file

- `backend/validators/base.validator.js`: Helper nền tảng, tạo lỗi, tạo kết quả, merge kết quả.
- `backend/validators/email.validator.js`: Kiểm tra email.
- `backend/validators/password.validator.js`: Kiểm tra mật khẩu.
- `backend/validators/phone.validator.js`: Kiểm tra số điện thoại.
- `backend/validators/price.validator.js`: Kiểm tra giá.
- `backend/validators/image.validator.js`: Kiểm tra file ảnh dạng Multer-like object.
- `backend/validators/pagination.validator.js`: Kiểm tra `page` và `limit`.
- `backend/validators/uuid.validator.js`: Kiểm tra UUID.
- `backend/validators/id.validator.js`: Kiểm tra ID số nguyên dương.
- `backend/validators/custom.validator.js`: Tạo validator tùy chỉnh cho rule riêng của module.
- `backend/validators/index.js`: Barrel export để module import từ một nơi.

## Error Format

Mỗi lỗi validation có dạng:

```json
{
  "field": "email",
  "message": "email must be a valid email address.",
  "location": "body",
  "code": "INVALID_EMAIL"
}
```

`validateRequest` sẽ chuyển danh sách lỗi này thành response `422 Unprocessable Entity`.

## Cách dùng sau này

Ví dụ validator cho một request:

```js
import { mergeValidationResults, validateEmail, validatePassword } from "../validators/index.js";

export function validateLoginRequest({ body }) {
  return mergeValidationResults([
    validateEmail(body.email, { required: true }),
    validatePassword(body.password, { required: true, strong: false })
  ]);
}
```

Khi gắn route:

```js
router.post("/login", validateRequest(validateLoginRequest), controller.login);
```

## Quy ước

- Validator không gọi service, repository hoặc MySQL.
- Validator chỉ nhận input và trả `createValidationResult`.
- Rule nghiệp vụ phức tạp nằm ở service; validator chỉ kiểm tra dữ liệu request.
- Không log password hoặc token trong validator.
- Các field sort/filter được phép nên khai báo whitelist ở từng module.
