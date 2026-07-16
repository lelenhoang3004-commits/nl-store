# API Standard

Tài liệu này định nghĩa convention RESTful dùng chung cho backend. Hiện tại dự án chưa có API nghiệp vụ, CRUD, SQL hoặc authentication; các chuẩn dưới đây là hợp đồng để các module sau triển khai nhất quán.

## Nguyên tắc RESTful

- URL dùng danh từ số nhiều: `/api/v1/products`, `/api/v1/orders`.
- Method thể hiện hành động: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.
- Controller chỉ xử lý HTTP request/response.
- Service xử lý nghiệp vụ.
- Repository là nơi duy nhất được viết truy vấn MySQL.
- Validator kiểm tra `params`, `query`, `body` trước controller.
- Response luôn đi qua `ApiResponse`.
- Lỗi chủ động dùng `AppError`; lỗi còn lại đi qua `errorHandler`.

## Response Format

Success response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "meta": null,
  "timestamp": "2026-07-06T11:00:00.000Z"
}
```

Error response:

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed.",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": []
  },
  "timestamp": "2026-07-06T11:00:00.000Z"
}
```

## Validation

Validation chạy trước controller bằng `validateRequest`.

Chuẩn lỗi validation:

```json
[
  {
    "field": "email",
    "message": "Email is required.",
    "location": "body"
  }
]
```

HTTP status mặc định cho validation là `422 Unprocessable Entity`.

## Pagination

Query chuẩn:

```text
?page=1&limit=10
```

Meta chuẩn:

```json
{
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 125,
    "totalPages": 13,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Quy ước:

- `page` bắt đầu từ `1`.
- `limit` mặc định là `10`.
- `limit` tối đa là `100`.
- Repository nhận `offset` và `limit`, không tự parse query.

## Search

Query chuẩn:

```text
?search=shirt
```

Quy ước:

- Search keyword được trim ở utility layer.
- Search rỗng không áp dụng điều kiện.
- Field được phép search phải do từng module định nghĩa.

## Sort

Query chuẩn:

```text
?sortBy=createdAt&sortOrder=desc
```

Quy ước:

- `sortOrder` chỉ nhận `asc` hoặc `desc`.
- Nếu sai field, fallback về field mặc định của module.
- Không truyền trực tiếp sort field chưa được whitelist xuống repository.

## Filter

Query chuẩn:

```text
?status=active&categoryId=1
```

Quy ước:

- Mỗi module khai báo danh sách filter được phép.
- Filter rỗng không được đưa xuống repository.
- Filter nâng cao có thể dùng prefix rõ nghĩa sau này, ví dụ `priceMin`, `priceMax`.

## Meta

`meta` chứa dữ liệu mô tả response, không chứa dữ liệu nghiệp vụ chính.

Ví dụ:

```json
{
  "pagination": {},
  "search": {
    "keyword": "shirt",
    "enabled": true
  },
  "sort": {
    "field": "createdAt",
    "direction": "desc"
  },
  "filter": {
    "status": "active"
  }
}
```

## HTTP Status Code

- `200 OK`: Lấy dữ liệu hoặc thao tác thành công.
- `201 Created`: Tạo mới thành công.
- `204 No Content`: Xóa thành công và không trả body.
- `400 Bad Request`: Request sai cấu trúc.
- `401 Unauthorized`: Chưa đăng nhập hoặc token không hợp lệ.
- `403 Forbidden`: Không đủ quyền.
- `404 Not Found`: Không tìm thấy resource hoặc route.
- `409 Conflict`: Trùng dữ liệu hoặc xung đột trạng thái.
- `422 Unprocessable Entity`: Validation fail.
- `429 Too Many Requests`: Vượt giới hạn request.
- `500 Internal Server Error`: Lỗi hệ thống ngoài dự kiến.
- `503 Service Unavailable`: Dịch vụ phụ thuộc không sẵn sàng.

## Middleware Convention

Thứ tự middleware chuẩn:

```text
Security
Request Logger
Body Parser
Cookie Parser
Static
Route
Validation
Controller
404 Handler
Global Error Handler
```

Middleware không được chứa nghiệp vụ module. Nghiệp vụ nằm trong service.

## Request Flow

```text
Request
↓
Route
↓
Middleware
↓
Validation
↓
Controller
↓
Service
↓
Repository
↓
MySQL
↓
Response
```

## File liên quan

- `backend/utils/api-response.util.js`: Chuẩn hóa success/error response.
- `backend/utils/app-error.util.js`: Lỗi có kiểm soát với status code và error code.
- `backend/utils/query-options.util.js`: Parse pagination/search/sort/filter.
- `backend/middleware/validate-request.middleware.js`: Cổng validation trước controller.
- `backend/middleware/error-handler.middleware.js`: Chuẩn hóa lỗi toàn hệ thống.
- `backend/controllers/base.controller.js`: Helper trả response thành công cho controller.
