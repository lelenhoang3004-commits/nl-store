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
  createPaymentSession({ orderId, orderCode, amount, transactionCode }) {
    const configured = Boolean(process.env.MOMO_PARTNER_CODE && process.env.MOMO_ACCESS_KEY && process.env.MOMO_SECRET_KEY);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    if (!configured) {
      return {
        provider: "MOMO",
        available: false,
        status: "PENDING",
        transactionId: transactionCode,
        expiresAt,
        orderId,
        orderCode,
        amount: Number(amount || 0),
        currency: "VND",
        qrCodeUrl: "",
        deeplink: "",
        payUrl: "",
        message: "Thanh toan MoMo dang duoc cau hinh. Don hang chua duoc xac nhan thanh toan."
      };
    }

    return {
      provider: "MOMO",
      available: false,
      status: "PENDING",
      transactionId: transactionCode,
      expiresAt,
      orderId,
      orderCode,
      amount: Number(amount || 0),
      currency: "VND",
      qrCodeUrl: "",
      deeplink: "",
      payUrl: "",
      message: "MoMo credentials are present, but live request signing is not enabled in this build."
    };
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