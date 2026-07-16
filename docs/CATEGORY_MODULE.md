# Category Module

Tài liệu này mô tả Category Module của backend. Module này được xây theo MVC, Repository Pattern và Service Layer, không phụ thuộc Product.

## Base Path

```text
/api/v1/categories
```

## Endpoint

- `GET /`: Lấy danh sách danh mục.
- `GET /:id`: Lấy chi tiết danh mục.
- `POST /`: Tạo danh mục.
- `PUT /:id`: Cập nhật danh mục.
- `DELETE /:id`: Soft delete danh mục.

Tất cả endpoint đều yêu cầu `Authorization: Bearer <accessToken>`.

## Permission

- Xem danh mục: `category:view`.
- Tạo, sửa, xóa danh mục: `category:manage`.

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
Category Controller
↓
Category Service
↓
Category Repository
↓
MySQL
↓
Response
```

## Query List

```text
GET /api/v1/categories?page=1&limit=10&search=shirt&status=active&sortBy=createdAt&sortOrder=desc
```

Hỗ trợ:

- `page`
- `limit`
- `search`
- `status`
- `parentId`
- `sortBy`
- `sortOrder`

Sort fields được whitelist:

- `createdAt`
- `updatedAt`
- `name`
- `slug`
- `status`
- `sortOrder`

## Body

Create/Update body:

```json
{
  "name": "Áo sơ mi",
  "slug": "ao-so-mi",
  "description": "Danh mục áo sơ mi thời trang",
  "parentId": null,
  "imageUrl": "/uploads/images/category.webp",
  "status": "active",
  "sortOrder": 1
}
```

Nếu không truyền `slug`, service sẽ tự sinh slug từ `name`.

## Response

List response:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Categories retrieved successfully.",
  "data": {
    "categories": []
  },
  "meta": {
    "pagination": {},
    "search": {},
    "sort": {},
    "filter": {}
  }
}
```

## Database Contract

Repository kỳ vọng bảng `categories` có các cột:

- `id`
- `name`
- `slug`
- `description`
- `parent_id`
- `image_url`
- `status`
- `sort_order`
- `created_at`
- `updated_at`
- `deleted_at`

Module dùng soft delete bằng `deleted_at`, không xóa cứng dữ liệu.

## File chính

- `backend/models/category.model.js`
- `backend/repositories/category.repository.js`
- `backend/services/category.service.js`
- `backend/controllers/category.controller.js`
- `backend/routes/category.routes.js`
- `backend/validators/category.validator.js`
- `backend/utils/slug.util.js`

## Quy ước

- SQL chỉ nằm trong repository.
- Business rule nằm trong service.
- Controller chỉ xử lý HTTP request/response.
- Validator kiểm tra input trước controller.
- Route dùng authentication và permission middleware.
- Không import hoặc phụ thuộc Product Module.
