# Order Module

Tài liệu này mô tả Order Module của backend. Module này xử lý order, order detail, status history, payment summary và transaction theo MVC, Repository Pattern, Service Layer, Validation, Middleware và RESTful convention hiện tại.

## Base Path

```text
/api/v1/orders
```

## Endpoint

- `GET /`: Lấy danh sách đơn hàng.
- `POST /`: Tạo đơn hàng.
- `GET /:id`: Lấy chi tiết tổng hợp đơn hàng.
- `GET /:id/details`: Lấy order detail.
- `GET /:id/history`: Lấy lịch sử trạng thái.
- `GET /:id/transactions`: Lấy giao dịch thanh toán.
- `PATCH /:id/status`: Cập nhật trạng thái đơn hàng và ghi history.
- `POST /:id/transactions`: Ghi nhận payment transaction và cập nhật payment summary.
- `DELETE /:id`: Soft delete đơn hàng.

Tất cả endpoint đều yêu cầu:

```text
Authorization: Bearer <accessToken>
```

## Permission

- Xem đơn hàng: `order:view`.
- Tạo, cập nhật trạng thái, ghi transaction, xóa đơn: `order:manage`.
- Xem transaction: `payment:view`.

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
Order Controller
↓
Order Service
↓
Order Repository
↓
MySQL
↓
Response
```

## Query List

```text
GET /api/v1/orders?page=1&limit=10&search=ORD&status=pending&paymentStatus=unpaid&sortBy=createdAt&sortOrder=desc
```

Hỗ trợ:

- `page`
- `limit`
- `search`
- `status`
- `paymentStatus`
- `paymentMethod`
- `customerId`
- `dateFrom`
- `dateTo`
- `sortBy`
- `sortOrder`

Sort fields được whitelist:

- `createdAt`
- `updatedAt`
- `orderCode`
- `status`
- `paymentStatus`
- `grandTotal`
- `paidAmount`

## Create Order Body

```json
{
  "customerId": 1,
  "customerName": "Nguyen Van A",
  "customerEmail": "customer@example.com",
  "customerPhone": "0901234567",
  "shippingAddress": {
    "fullName": "Nguyen Van A",
    "phone": "0901234567",
    "line1": "123 Nguyen Hue",
    "line2": "Floor 2",
    "ward": "Ben Nghe",
    "district": "District 1",
    "city": "Ho Chi Minh City",
    "province": "Ho Chi Minh",
    "country": "Vietnam",
    "postalCode": "700000"
  },
  "paymentMethod": "cod",
  "discountTotal": 0,
  "shippingFee": 30000,
  "taxTotal": 0,
  "note": "Giao giờ hành chính",
  "items": [
    {
      "productId": 1,
      "productName": "Áo sơ mi Oxford",
      "productSku": "SM-OXFORD-001",
      "productImageUrl": "/uploads/images/shirt.webp",
      "quantity": 2,
      "unitPrice": 499000,
      "discountAmount": 0
    }
  ]
}
```

Service tự tính:

- `subtotal`
- `grandTotal`
- `orderCode` nếu client không truyền
- `totalPrice` của từng item

## Status

Order status hợp lệ:

- `pending`
- `confirmed`
- `processing`
- `shipped`
- `delivered`
- `cancelled`
- `refunded`

Status transition được kiểm soát trong service. Ví dụ `pending` chỉ có thể chuyển sang `confirmed` hoặc `cancelled`.

Update status body:

```json
{
  "status": "confirmed",
  "note": "Đã xác nhận đơn hàng"
}
```

## Payment và Transaction

Payment status:

- `unpaid`
- `partial`
- `paid`
- `failed`
- `refunded`

Transaction status:

- `pending`
- `success`
- `failed`
- `refunded`

Create transaction body:

```json
{
  "transactionCode": "TRX-001",
  "provider": "manual",
  "method": "cod",
  "amount": 1028000,
  "status": "success",
  "paidAt": "2026-07-06T10:00:00.000Z",
  "metadata": {
    "note": "Thu tiền khi giao hàng"
  }
}
```

Khi transaction thành công, service cập nhật `paidAmount` và `paymentStatus`. Khi transaction refund, service trừ `paidAmount`.

## Database Contract

Repository kỳ vọng các bảng:

`orders`:

- `id`
- `order_code`
- `customer_id`
- `customer_name`
- `customer_email`
- `customer_phone`
- `shipping_address`
- `status`
- `payment_status`
- `payment_method`
- `subtotal`
- `discount_total`
- `shipping_fee`
- `tax_total`
- `grand_total`
- `paid_amount`
- `note`
- `created_at`
- `updated_at`
- `deleted_at`

`order_details`:

- `id`
- `order_id`
- `product_id`
- `product_name`
- `product_sku`
- `product_image_url`
- `quantity`
- `unit_price`
- `discount_amount`
- `total_price`

`order_histories`:

- `id`
- `order_id`
- `status`
- `note`
- `changed_by`
- `created_at`

`order_transactions`:

- `id`
- `order_id`
- `transaction_code`
- `provider`
- `method`
- `amount`
- `status`
- `paid_at`
- `metadata`
- `created_at`

## File chính

- `backend/models/order.model.js`
- `backend/repositories/order.repository.js`
- `backend/services/order.service.js`
- `backend/controllers/order.controller.js`
- `backend/routes/order.routes.js`
- `backend/validators/order.validator.js`

## Quy ước

- SQL chỉ nằm trong repository.
- Business rule nằm trong service.
- Controller chỉ xử lý HTTP request/response.
- Validator kiểm tra input trước controller.
- Tạo order, cập nhật status, và ghi transaction dùng transaction boundary.
- Lịch sử trạng thái được ghi vào `order_histories`.
- Không chứa Dashboard logic.
