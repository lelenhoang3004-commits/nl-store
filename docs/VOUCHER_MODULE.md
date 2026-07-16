# Voucher Module

Tài liệu này mô tả Voucher Module của backend. Module xử lý CRUD, expiration, quantity, discount, condition, validation, repository, service và RESTful convention.

## Base Path

```text
/api/v1/vouchers
```

## Endpoint

- `GET /`: Lấy danh sách voucher.
- `GET /:id`: Lấy chi tiết voucher.
- `POST /`: Tạo voucher.
- `PUT /:id`: Cập nhật voucher.
- `DELETE /:id`: Soft delete voucher.

Tất cả endpoint đều yêu cầu:

```text
Authorization: Bearer <accessToken>
```

## Permission

- Xem voucher: `voucher:view`.
- Tạo, sửa, xóa voucher: `voucher:manage`.

## Query List

```text
GET /api/v1/vouchers?page=1&limit=10&search=SUMMER&status=active&discountType=percentage&expiring=true&sortBy=createdAt&sortOrder=desc
```

Hỗ trợ:

- `page`
- `limit`
- `search`
- `status`
- `discountType`
- `expiring`
- `expired`
- `sortBy`
- `sortOrder`

## Discount

Discount type hợp lệ:

- `percentage`
- `fixed`
- `free_shipping`

Rules:

- `percentage` không được vượt quá `100`.
- `fixed` là số tiền giảm trực tiếp.
- `free_shipping` phải có `discountValue = 0`.
- `maxDiscountAmount` dùng để giới hạn số tiền giảm cho percentage voucher.

## Quantity

- `quantity`: tổng lượt dùng tối đa.
- `usedQuantity`: số lượt đã dùng.
- `quantity` không được nhỏ hơn `usedQuantity`.
- API trả thêm `remainingQuantity`.

## Expiration

- `startsAt`: thời gian bắt đầu hiệu lực.
- `expiresAt`: thời gian hết hạn.
- `startsAt` phải trước hoặc bằng `expiresAt`.
- Filter `expiring=true` trả voucher hết hạn trong 7 ngày.
- Filter `expired=true` trả voucher đã hết hạn.

## Condition

`conditions` được lưu JSON để dễ mở rộng:

```json
{
  "customerGroups": ["vip"],
  "productIds": [1, 2],
  "categoryIds": [3],
  "firstOrderOnly": true,
  "minItems": 2
}
```

Ý nghĩa:

- `customerGroups`: nhóm khách hàng được áp dụng.
- `productIds`: sản phẩm được áp dụng.
- `categoryIds`: danh mục được áp dụng.
- `firstOrderOnly`: chỉ áp dụng đơn đầu tiên.
- `minItems`: số lượng sản phẩm tối thiểu.

## Body

Create/Update body:

```json
{
  "code": "SUMMER2026",
  "name": "Summer Sale",
  "description": "Giảm giá mùa hè",
  "discountType": "percentage",
  "discountValue": 15,
  "maxDiscountAmount": 100000,
  "minOrderAmount": 500000,
  "quantity": 100,
  "usedQuantity": 0,
  "startsAt": "2026-07-01T00:00:00.000Z",
  "expiresAt": "2026-07-31T23:59:59.000Z",
  "status": "active",
  "conditions": {
    "customerGroups": ["vip"],
    "productIds": [],
    "categoryIds": [],
    "firstOrderOnly": false,
    "minItems": 1
  }
}
```

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
Voucher Controller
↓
Voucher Service
↓
Voucher Repository
↓
MySQL
↓
Response
```

## Database Contract

Repository kỳ vọng bảng `vouchers` có các cột:

- `id`
- `code`
- `name`
- `description`
- `discount_type`
- `discount_value`
- `max_discount_amount`
- `min_order_amount`
- `quantity`
- `used_quantity`
- `starts_at`
- `expires_at`
- `status`
- `conditions`
- `created_at`
- `updated_at`
- `deleted_at`

## File chính

- `backend/models/voucher.model.js`
- `backend/repositories/voucher.repository.js`
- `backend/services/voucher.service.js`
- `backend/controllers/voucher.controller.js`
- `backend/routes/voucher.routes.js`
- `backend/validators/voucher.validator.js`

## Quy ước

- SQL chỉ nằm trong repository.
- Business rule nằm trong service.
- Controller chỉ xử lý HTTP request/response.
- Validator kiểm tra input trước controller.
- Dùng soft delete bằng `deleted_at`.
- Không chứa Dashboard logic.
