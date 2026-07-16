# API Service

API Service là tầng giao tiếp Backend dùng chung cho Admin.

Hiện tại chưa gọi API thật từ giao diện. Khi có Backend, chỉ cần đổi `baseURL` trong:

`frontend/admin/services/api/api.config.js`

## Cấu trúc

- `api-client.js`: HTTP client dùng `fetch`.
- `api.config.js`: baseURL, timeout, retry mặc định.
- `token.service.js`: lưu access token và refresh token.
- `refresh-token.service.js`: chuẩn bị refresh token khi gặp HTTP 401.
- `interceptors.js`: request, response, error interceptor.
- `response-handler.js`: chuẩn hóa response và download blob.
- `api-error.js`: chuẩn hóa lỗi.
- `retry.service.js`: retry request lỗi mạng hoặc 5xx.
- `category.service.js`: ví dụ service module.

## Ví dụ dùng sau này

```js
import { categoryService } from "../services/category.service.js";

const response = await categoryService.getAll({ page: 1, keyword: "ao" });
```

Service đã hỗ trợ:

- GET
- POST
- PUT
- DELETE
- Upload
- Download
- Interceptor
- Loading
- Error Handler
- Token
- Refresh Token
- Retry
- Timeout
- Response Handler
