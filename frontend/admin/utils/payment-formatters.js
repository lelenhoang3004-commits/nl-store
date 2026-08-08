export const PAYMENT_METHOD_LABELS = Object.freeze({
  cod: "COD",
  bank_transfer: "Ngân hàng",
  bank_personal_qr: "Ngân hàng",
  bank_qr: "Ngân hàng",
  bank: "Ngân hàng",
  momo: "MoMo",
  momo_personal_qr: "MoMo",
  credit_card: "Th\u1ebb t\u00edn d\u1ee5ng",
  credit_card_demo: "Th\u1ebb t\u00edn d\u1ee5ng"
});
export const SUPPORTED_CHECKOUT_PAYMENT_METHODS = Object.freeze([
  { code: "cod", label: PAYMENT_METHOD_LABELS.cod, footerLabel: "COD" },
  { code: "bank_transfer", label: PAYMENT_METHOD_LABELS.bank_transfer, footerLabel: "Chuyển khoản" },
  { code: "momo", label: PAYMENT_METHOD_LABELS.momo, footerLabel: "MoMo" },
  { code: "CREDIT_CARD", label: PAYMENT_METHOD_LABELS.credit_card, footerLabel: "Thẻ tín dụng" }
]);
const ORDER_STATUS_LABELS = Object.freeze({
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao hàng",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  canceled: "Đã hủy",
  refunded: "Đã hoàn tiền"
});

const PAYMENT_STATUS_LABELS = Object.freeze({
  pending: "Chờ thanh toán",
  unpaid: "Chờ thanh toán",
  customer_reported: "Khách đã báo thanh toán",
  waiting_confirmation: "Đang chờ xác nhận",
  processing: "Đang xử lý",
  paid: "Đã thanh toán",
  success: "Đã thanh toán",
  completed: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  cancelled: "Đã hủy",
  canceled: "Đã hủy",
  expired: "Đã hết hạn",
  refunded: "Đã hoàn tiền",
  partial: "Thanh toán một phần"
});

const ROLE_LABELS = Object.freeze({
  admin: "Quản trị viên",
  staff: "Nhân viên",
  customer: "Khách hàng",
  user: "Người dùng"
});

const PRODUCT_STATUS_LABELS = Object.freeze({
  active: "Đang bán",
  inactive: "Tạm ngừng bán",
  draft: "Bản nháp",
  archived: "Đã lưu trữ",
  deleted: "Đã xóa",
  out_of_stock: "Hết hàng"
});

const VOUCHER_STATUS_LABELS = Object.freeze({
  active: "Đang hoạt động",
  inactive: "Tạm khóa",
  scheduled: "Chưa bắt đầu",
  expired: "Hết hạn",
  soldout: "Hết lượt",
  used_up: "Hết lượt"
});

export function formatOrderStatus(status = "") {
  const key = normalizeCode(status);
  return ORDER_STATUS_LABELS[key] || String(status || "-");
}

export function formatPaymentMethod(method = "") {
  const raw = String(method || "").trim();
  const key = normalizeCode(raw);
  if (raw.toLowerCase() === "chuyển khoản ngân hàng") return "Ngân hàng";
  return PAYMENT_METHOD_LABELS[key] || raw || "-";
}

export function formatPaymentStatus(status = "") {
  const key = normalizeCode(status);
  return PAYMENT_STATUS_LABELS[key] || String(status || "-");
}

export function normalizePaymentStatus(status = "") {
  const key = normalizeCode(status);
  if (key === "success" || key === "completed") return "paid";
  if (key === "canceled") return "cancelled";
  if (key === "waiting_confirmation" || key === "customer_reported") return "processing";
  return key;
}

export function normalizeOrderStatus(status = "") {
  const key = normalizeCode(status);
  if (key === "canceled") return "cancelled";
  return key;
}

export function formatRole(role = "") {
  const key = normalizeCode(role);
  return ROLE_LABELS[key] || String(role || "-");
}

export function formatProductStatus(status = "") {
  const key = normalizeCode(status);
  return PRODUCT_STATUS_LABELS[key] || String(status || "-");
}

export function formatVariantStatus(status = "") {
  return formatProductStatus(status);
}

export function formatVoucherStatus(status = "") {
  const key = normalizeCode(status);
  return VOUCHER_STATUS_LABELS[key] || String(status || "-");
}

function normalizeCode(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}
