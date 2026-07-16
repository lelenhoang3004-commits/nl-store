# Newsletter Module

Tài liệu này mô tả Newsletter Module của backend. Module xử lý subscribe, unsubscribe, email validation, pagination, repository, service và RESTful convention.

## Base Path

```text
/api/v1/newsletter
```

## Public Endpoint

- `POST /subscribe`: Đăng ký nhận email.
- `POST /unsubscribe`: Hủy đăng ký bằng email.
- `GET /unsubscribe/:token`: Hủy đăng ký bằng token.

Các endpoint public không yêu cầu login.

## Admin Endpoint

- `GET /subscribers`: Lấy danh sách subscriber.
- `GET /subscribers/:id`: Lấy chi tiết subscriber.

Admin endpoint yêu cầu:

```text
Authorization: Bearer <accessToken>
```

Permission:

```text
email:view
```

## Subscribe Body

```json
{
  "email": "customer@example.com",
  "fullName": "Nguyen Van A",
  "source": "website"
}
```

Rules:

- Email là bắt buộc và phải hợp lệ.
- Nếu email chưa tồn tại, tạo subscriber mới.
- Nếu email đã subscribed, trả lại subscriber hiện tại.
- Nếu email đã unsubscribed, hệ thống resubscribe và tạo unsubscribe token mới.

## Unsubscribe Body

```json
{
  "email": "customer@example.com"
}
```

Unsubscribe token dùng cho link email:

```text
GET /api/v1/newsletter/unsubscribe/:token
```

## Query List

```text
GET /api/v1/newsletter/subscribers?page=1&limit=10&search=customer&status=subscribed&source=website&sortBy=createdAt&sortOrder=desc
```

Hỗ trợ:

- `page`
- `limit`
- `search`
- `status`
- `source`
- `sortBy`
- `sortOrder`

Status hợp lệ:

- `subscribed`
- `unsubscribed`

## Request Flow

```text
Request
↓
Route
↓
Validation Middleware
↓
Newsletter Controller
↓
Newsletter Service
↓
Newsletter Repository
↓
MySQL
↓
Response
```

Admin list/detail có thêm:

```text
Authentication Middleware
↓
Permission Middleware
```

## Database Contract

Repository kỳ vọng bảng `newsletter_subscribers` có các cột:

- `id`
- `email`
- `full_name`
- `source`
- `status`
- `unsubscribe_token`
- `subscribed_at`
- `unsubscribed_at`
- `created_at`
- `updated_at`

## File chính

- `backend/models/newsletter.model.js`
- `backend/repositories/newsletter.repository.js`
- `backend/services/newsletter.service.js`
- `backend/controllers/newsletter.controller.js`
- `backend/routes/newsletter.routes.js`
- `backend/validators/newsletter.validator.js`

## Quy ước

- SQL chỉ nằm trong repository.
- Business rule nằm trong service.
- Controller chỉ xử lý HTTP request/response.
- Validator kiểm tra email và query trước controller.
- Public subscribe/unsubscribe không yêu cầu JWT.
- Admin list/detail yêu cầu `email:view`.
