# Product Module

Tài liệu này mô tả Product Module của backend. Module này tuân thủ MVC, Repository Pattern, Service Layer, Validation, Middleware và RESTful convention hiện tại.

## Base Path

```text
/api/v1/products
```

## Endpoint

- `GET /`: Lấy danh sách sản phẩm.
- `GET /:id`: Lấy chi tiết sản phẩm.
- `POST /`: Tạo sản phẩm.
- `PUT /:id`: Cập nhật sản phẩm.
- `DELETE /:id`: Soft delete sản phẩm.
- `POST /images`: Upload nhiều ảnh sản phẩm, field name là `images`.

Tất cả endpoint đều yêu cầu:

```text
Authorization: Bearer <accessToken>
```

## Permission

- Xem sản phẩm: `product:view`.
- Tạo, sửa, xóa, upload ảnh sản phẩm: `product:manage`.

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
Product Controller
↓
Product Service
↓
Product Repository
↓
MySQL
↓
Response
```

## Query List

```text
GET /api/v1/products?page=1&limit=10&search=shirt&status=active&categoryId=1&stockStatus=inStock&sortBy=createdAt&sortOrder=desc
```

Hỗ trợ:

- `page`
- `limit`
- `search`
- `status`
- `categoryId`
- `brand`
- `stockStatus`
- `priceMin`
- `priceMax`
- `sortBy`
- `sortOrder`

Sort fields được whitelist:

- `createdAt`
- `updatedAt`
- `name`
- `slug`
- `sku`
- `price`
- `salePrice`
- `stock`
- `sold`
- `status`

## Body

Create/Update body:

```json
{
  "name": "Áo sơ mi Oxford",
  "slug": "ao-so-mi-oxford",
  "sku": "SM-OXFORD-001",
  "categoryId": 1,
  "brand": "Fashion Store",
  "shortDescription": "Áo sơ mi basic dễ phối đồ",
  "description": "Mô tả chi tiết sản phẩm",
  "price": 499000,
  "salePrice": 399000,
  "stock": 120,
  "sold": 0,
  "status": "active",
  "thumbnailUrl": "/uploads/images/shirt.webp",
  "galleryUrls": ["/uploads/images/shirt-1.webp"],
  "tags": ["shirt", "men"]
}
```

Nếu không truyền `slug`, service sẽ tự sinh slug từ `name`.

## Upload

Upload ảnh sản phẩm:

```text
POST /api/v1/products/images
```

Field name:

```text
images
```

Module Product tái sử dụng `uploadImage` middleware và `UploadService`, không viết lại Multer.

Response upload:

```json
{
  "files": [
    {
      "originalName": "shirt.webp",
      "fileName": "shirt-1720260000000-id.webp",
      "mimeType": "image/webp",
      "size": 120000,
      "folder": "images",
      "extension": ".webp",
      "url": "/uploads/images/shirt-1720260000000-id.webp"
    }
  ]
}
```

## Database Contract

Repository kỳ vọng bảng `products` có các cột:

- `id`
- `name`
- `slug`
- `sku`
- `category_id`
- `brand`
- `short_description`
- `description`
- `price`
- `sale_price`
- `stock`
- `sold`
- `status`
- `thumbnail_url`
- `gallery_urls`
- `tags`
- `created_at`
- `updated_at`
- `deleted_at`

Module có join sang bảng `categories` để trả thêm `categoryName`.

## File chính

- `backend/models/product.model.js`
- `backend/repositories/product.repository.js`
- `backend/services/product.service.js`
- `backend/controllers/product.controller.js`
- `backend/routes/product.routes.js`
- `backend/validators/product.validator.js`

## Quy ước

- SQL chỉ nằm trong repository.
- Business rule nằm trong service.
- Controller chỉ xử lý HTTP request/response.
- Validator kiểm tra input trước controller.
- Route dùng authentication và permission middleware.
- Không phụ thuộc User, Order, Payment hoặc Dashboard module.
