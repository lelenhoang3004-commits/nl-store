const PAYMENT_METHOD_LABELS = Object.freeze({
  cod: "Thanh to\u00e1n khi nh\u1eadn h\u00e0ng",
  bank_transfer: "Chuy\u1ec3n kho\u1ea3n ng\u00e2n h\u00e0ng",
  bank_personal_qr: "Chuy\u1ec3n kho\u1ea3n ng\u00e2n h\u00e0ng",
  momo: "Thanh to\u00e1n b\u1eb1ng MoMo",
  momo_personal_qr: "Thanh to\u00e1n b\u1eb1ng MoMo",
  credit_card: "Thanh to\u00e1n b\u1eb1ng th\u1ebb t\u00edn d\u1ee5ng",
  credit_card_demo: "Thanh to\u00e1n b\u1eb1ng th\u1ebb t\u00edn d\u1ee5ng"
});

const PAYMENT_STATUS_LABELS = Object.freeze({
  pending: "Ch\u1edd thanh to\u00e1n",
  unpaid: "Ch\u1edd thanh to\u00e1n",
  customer_reported: "Kh\u00e1ch \u0111\u00e3 b\u00e1o thanh to\u00e1n",
  waiting_confirmation: "\u0110ang ch\u1edd x\u00e1c nh\u1eadn",
  processing: "\u0110ang x\u1eed l\u00fd",
  paid: "\u0110\u00e3 thanh to\u00e1n",
  success: "\u0110\u00e3 thanh to\u00e1n",
  completed: "\u0110\u00e3 thanh to\u00e1n",
  failed: "Thanh to\u00e1n th\u1ea5t b\u1ea1i",
  cancelled: "\u0110\u00e3 h\u1ee7y",
  canceled: "\u0110\u00e3 h\u1ee7y",
  expired: "\u0110\u00e3 h\u1ebft h\u1ea1n",
  refunded: "\u0110\u00e3 ho\u00e0n ti\u1ec1n",
  partial: "Thanh to\u00e1n m\u1ed9t ph\u1ea7n"
});

export function formatPaymentMethod(method = "") {
  const key = normalizeCode(method);
  return PAYMENT_METHOD_LABELS[key] || String(method || "-");
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

function normalizeCode(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}
