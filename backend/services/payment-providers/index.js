import crypto from "node:crypto";

const DEFAULT_BANK_CONFIG = Object.freeze({
  bankName: "N&L Store Bank",
  bankCode: "970436",
  accountNumber: "0000000000",
  accountName: "N L STORE",
  qrTtlMinutes: 15
});

export class BankTransferProviderAdapter {
  createPaymentSession({ orderId, orderCode, amount, transactionCode }) {
    const config = getBankTransferConfig();
    const transferContent = createTransferContent(orderCode || orderId);
    const expiresAt = new Date(Date.now() + config.qrTtlMinutes * 60 * 1000).toISOString();
    const qrCodeUrl = createVietQrUrl(config, amount, transferContent);

    return {
      provider: "BANK_TRANSFER",
      available: true,
      status: "PENDING",
      transactionId: transactionCode,
      expiresAt,
      qrCodeUrl,
      bank: {
        bankName: config.bankName,
        bankCode: config.bankCode,
        accountNumber: maskAccountNumber(config.accountNumber),
        accountName: config.accountName
      },
      rawAccountNumber: config.accountNumber,
      amount: Number(amount || 0),
      currency: "VND",
      orderId,
      orderCode,
      transferContent,
      message: "Don hang se duoc xu ly sau khi cua hang xac nhan khoan chuyen."
    };
  }

  confirmPayment() {
    return { status: "PENDING", message: "Bank transfer requires webhook or manual admin confirmation." };
  }

  getPaymentStatus() {
    return { status: "PENDING" };
  }

  handleWebhook() {
    return { verified: false, status: "PENDING", message: "Bank webhook adapter is not configured." };
  }

  refundPayment() {
    return { status: "PENDING", message: "Manual refund flow is required." };
  }
}

export class MomoProviderAdapter {
  async createPaymentSession({ orderId, orderCode, amount, transactionCode }) {
    const config = getMomoConfig();
    const configured = isMomoSandboxReady(config);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const roundedAmount = Math.max(Math.round(Number(amount || 0)), 0);

    if (!configured.ready) {
      return { provider: "MOMO", available: false, status: "PENDING", transactionId: transactionCode, expiresAt, orderId, orderCode, amount: roundedAmount, currency: "VND", qrCodeUrl: "", deeplink: "", payUrl: "", resultCode: null, message: configured.message };
    }

    const requestId = transactionCode + "-" + Date.now();
    const momoOrderId = String(orderCode || orderId).replace(/[^a-zA-Z0-9]/g, "").slice(-32) + "-" + Date.now();
    const orderInfo = config.orderInfoPrefix + " " + (orderCode || orderId);
    const extraData = Buffer.from(JSON.stringify({ orderId, orderCode, transactionCode })).toString("base64");
    const requestType = config.requestType;
    const rawSignature = ["accessKey=" + config.accessKey, "amount=" + roundedAmount, "extraData=" + extraData, "ipnUrl=" + config.ipnUrl, "orderId=" + momoOrderId, "orderInfo=" + orderInfo, "partnerCode=" + config.partnerCode, "redirectUrl=" + config.redirectUrl, "requestId=" + requestId, "requestType=" + requestType].join("&");
    const signature = crypto.createHmac("sha256", config.secretKey).update(rawSignature).digest("hex");
    const body = { partnerCode: config.partnerCode, partnerName: config.partnerName, storeId: config.storeId, requestId, amount: roundedAmount, orderId: momoOrderId, orderInfo, redirectUrl: config.redirectUrl, ipnUrl: config.ipnUrl, lang: "vi", requestType, autoCapture: true, extraData, signature };

    try {
      const response = await postJson(config.createEndpoint, body, config.timeoutMs);
      const success = Number(response.resultCode) === 0 && Boolean(response.payUrl || response.deeplink || response.qrCodeUrl);
      return { provider: "MOMO", available: success, status: "PENDING", transactionId: transactionCode, providerTransactionId: response.transId || null, requestId, momoOrderId, momo_order_id: momoOrderId, expiresAt, orderId, orderCode, amount: roundedAmount, currency: "VND", qrCodeUrl: response.qrCodeUrl || "", deeplink: response.deeplink || "", payUrl: response.payUrl || "", resultCode: response.resultCode, message: response.message || (success ? "MoMo sandbox payment session created." : "MoMo sandbox did not return a payment URL.") };
    } catch (error) {
      return { provider: "MOMO", available: false, status: "PENDING", transactionId: transactionCode, requestId, momoOrderId, momo_order_id: momoOrderId, expiresAt, orderId, orderCode, amount: roundedAmount, currency: "VND", qrCodeUrl: "", deeplink: "", payUrl: "", resultCode: null, message: error?.message || "Unable to create MoMo sandbox payment session." };
    }
  }

  confirmPayment() { return { status: "PENDING" }; }
  getPaymentStatus() { return { status: "PENDING" }; }
  handleWebhook() { return { verified: false, status: "PENDING" }; }
  refundPayment() { return { status: "PENDING" }; }
}

export class CreditCardProviderAdapter {
  createPaymentSession({ orderId, orderCode, amount, transactionCode }) {
    const configured = Boolean(process.env.CARD_PAYMENT_PROVIDER && process.env.CARD_PAYMENT_SECRET_KEY);
    return {
      provider: "CREDIT_CARD",
      available: false,
      configured,
      status: "PENDING",
      transactionId: transactionCode,
      orderId,
      orderCode,
      amount: Number(amount || 0),
      currency: "VND",
      publishableKey: process.env.CARD_PAYMENT_PUBLISHABLE_KEY || "",
      clientSecret: "",
      message: configured
        ? "Card provider configuration detected, but hosted payment fields are not enabled in this build."
        : "Thanh toan the dang duoc hoan thien."
    };
  }

  confirmPayment() { return { status: "PENDING" }; }
  getPaymentStatus() { return { status: "PENDING" }; }
  handleWebhook() { return { verified: false, status: "PENDING" }; }
  refundPayment() { return { status: "PENDING" }; }
}

export function createPaymentProviderAdapter(method) {
  const normalized = String(method || "").toLowerCase();
  if (normalized === "bank_transfer") return new BankTransferProviderAdapter();
  if (normalized === "momo") return new MomoProviderAdapter();
  if (normalized === "credit_card") return new CreditCardProviderAdapter();
  return null;
}

function getBankTransferConfig() {
  return {
    bankName: process.env.BANK_TRANSFER_BANK_NAME || DEFAULT_BANK_CONFIG.bankName,
    bankCode: process.env.BANK_TRANSFER_BANK_CODE || DEFAULT_BANK_CONFIG.bankCode,
    accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER || DEFAULT_BANK_CONFIG.accountNumber,
    accountName: process.env.BANK_TRANSFER_ACCOUNT_NAME || DEFAULT_BANK_CONFIG.accountName,
    qrTtlMinutes: Number(process.env.BANK_TRANSFER_QR_TTL_MINUTES || DEFAULT_BANK_CONFIG.qrTtlMinutes)
  };
}

function isMomoSandboxReady(config) {
  if (String(config.env || "").toLowerCase() !== "sandbox") {
    return { ready: false, message: "MoMo Sandbox is disabled. Set MOMO_ENV=sandbox to create real MoMo test payments." };
  }
  const required = [config.createEndpoint, config.partnerCode, config.accessKey, config.secretKey, config.requestType, config.redirectUrl, config.ipnUrl];
  if (required.some((value) => !String(value || "").trim())) {
    return { ready: false, message: "MoMo Sandbox is missing required environment variables." };
  }
  if (config.requestType !== "captureWallet") {
    return { ready: false, message: "MoMo Sandbox requires MOMO_REQUEST_TYPE=captureWallet." };
  }
  return { ready: true, message: "MoMo Sandbox is ready." };
}

function getMomoConfig() {
  const clientOrigin = String(process.env.CLIENT_ORIGIN || "http://127.0.0.1:5500").replace(/\/+$/, "");
  const apiBaseUrl = String(process.env.API_BASE_URL || process.env.PUBLIC_API_URL || "http://localhost:5000").replace(/\/+$/, "");
  const apiPrefix = String(process.env.API_PREFIX || "/api/v1").replace(/^\/?/, "/").replace(/\/+$/, "");

  return {
    env: process.env.MOMO_ENV || "",
    createEndpoint: process.env.MOMO_ENDPOINT || process.env.MOMO_CREATE_ENDPOINT || (process.env.MOMO_BASE_URL || "https://test-payment.momo.vn") + "/v2/gateway/api/create",
    partnerCode: process.env.MOMO_PARTNER_CODE || "",
    accessKey: process.env.MOMO_ACCESS_KEY || "",
    secretKey: process.env.MOMO_SECRET_KEY || "",
    partnerName: process.env.MOMO_PARTNER_NAME || "N&L Store",
    storeId: process.env.MOMO_STORE_ID || "NLStore",
    orderInfoPrefix: process.env.MOMO_ORDER_INFO_PREFIX || "Thanh toan don hang N&L Store",
    requestType: process.env.MOMO_REQUEST_TYPE || "captureWallet",
    redirectUrl: process.env.MOMO_REDIRECT_URL || clientOrigin + "/customer/#orders",
    ipnUrl: process.env.MOMO_IPN_URL || apiBaseUrl + apiPrefix + "/payments/momo/ipn",
    timeoutMs: Math.max(Number(process.env.MOMO_TIMEOUT_MS || 30000), 30000)
  };
}

function createTransferContent(orderCode) {
  const cleanCode = String(orderCode || "ORDER").replace(/[^a-zA-Z0-9]/g, "").slice(-18).toUpperCase();
  return `NL ${cleanCode}`;
}

function createVietQrUrl(config, amount, transferContent) {
  const query = new URLSearchParams({
    amount: String(Math.round(Number(amount || 0))),
    addInfo: transferContent,
    accountName: config.accountName
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(config.bankCode)}-${encodeURIComponent(config.accountNumber)}-compact2.png?${query.toString()}`;
}

function maskAccountNumber(value) {
  const raw = String(value || "").replace(/\s+/g, "");
  if (raw.length <= 4) return raw;
  return `${raw.slice(0, 4)} ${raw.slice(4, -3).replace(/\d/g, "*")} ${raw.slice(-3)}`.trim();
}
async function postJson(url, body, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify(body), signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "MoMo request failed with HTTP " + response.status + ".");
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}
