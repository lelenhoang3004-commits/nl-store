import { ChatbotRepository } from "../repositories/chatbot.repository.js";

const FALLBACK_REPLY = "Xin lỗi, tôi chưa tìm thấy thông tin phù hợp. Bạn vui lòng thử diễn đạt câu hỏi theo cách khác hoặc liên hệ nhân viên N&L Store để được hỗ trợ.";
const TEMPORARY_ERROR_REPLY = "Xin lỗi, hệ thống đang tạm thời gặp sự cố. Bạn vui lòng thử lại sau ít phút.";

const POLICIES = Object.freeze({
  shipping_fee: "N&L Store sẽ hiển thị phí vận chuyển chính xác ở bước thanh toán theo địa chỉ nhận hàng và phương thức giao hàng. Nếu cần ước tính nhanh, bạn hãy thêm sản phẩm vào giỏ hàng rồi mở trang thanh toán.",
  delivery_time: "Thời gian giao hàng phụ thuộc địa chỉ nhận hàng và đơn vị vận chuyển. Thông thường shop sẽ xử lý đơn sau khi đặt thành công, còn thời gian dự kiến được cập nhật trong quá trình thanh toán hoặc khi shop xác nhận đơn.",
  return_policy: "Bạn có thể liên hệ N&L Store để được hỗ trợ đổi trả khi sản phẩm còn nguyên tình trạng theo quy định của shop. Dữ liệu chi tiết về số ngày đổi trả và điều kiện cụ thể hiện chưa được cấu hình trong hệ thống.",
  payment: "N&L Store hỗ trợ các phương thức thanh toán đang cấu hình trong website như thanh toán khi nhận hàng và các cổng thanh toán trực tuyến nếu được bật ở bước thanh toán.",
  warranty: "Chính sách bảo hành chi tiết chưa được cấu hình trong hệ thống. Bạn vui lòng liên hệ nhân viên N&L Store để được xác nhận theo từng sản phẩm.",
  contact: "Bạn có thể liên hệ N&L Store qua các kênh hiển thị trên website hoặc gửi yêu cầu hỗ trợ trực tiếp cho nhân viên cửa hàng."
});

export class ChatbotService {
  constructor(repository = new ChatbotRepository()) {
    this.repository = repository;
  }

  async replyToMessage({ message, user }) {
    const cleanMessage = normalizeMessage(message);
    const intent = detectIntent(cleanMessage);

    if (!cleanMessage) {
      return this.createResponse("Bạn vui lòng nhập nội dung cần hỗ trợ nhé.", [], defaultSuggestions());
    }

    if (intent === "unsafe_order_request") {
      return this.createResponse("Tôi không thể hiển thị đơn hàng của tài khoản khác. Bạn chỉ có thể xem đơn hàng của chính tài khoản đang đăng nhập.", [], ["Kiểm tra đơn hàng", "Chính sách đổi trả"]);
    }

    if (intent === "orders") {
      return this.handleOrders(user);
    }

    if (intent === "size") {
      return this.createResponse("Để tư vấn size chính xác hơn, bạn cho tôi thêm chiều cao, cân nặng và loại sản phẩm bạn muốn mua nhé. Nếu bạn đã có số đo vai, ngực, eo hoặc hông thì gửi thêm sẽ càng tốt.", [], ["Tìm sản phẩm", "Sản phẩm đang bán"]);
    }

    const policyReply = getPolicyReply(intent);
    if (policyReply) {
      return this.createResponse(policyReply, [], defaultSuggestions());
    }

    if (intent === "products") {
      return this.handleProducts(cleanMessage);
    }

    return this.createResponse(FALLBACK_REPLY, [], defaultSuggestions());
  }

  async handleProducts(message) {
    const criteria = extractProductCriteria(message);
    let products = [];

    try {
      products = criteria.hasCriteria
        ? await this.repository.searchProducts(criteria)
        : await this.repository.getActiveProductSamples(5);
    } catch {
      return this.createResponse(TEMPORARY_ERROR_REPLY, [], defaultSuggestions());
    }

    if (!products.length) {
      return this.createResponse(FALLBACK_REPLY, [], ["Tìm sản phẩm", "Sản phẩm đang bán"]);
    }

    const reply = criteria.hasCriteria
      ? `Tôi tìm thấy ${products.length} sản phẩm phù hợp nhất với nhu cầu của bạn.`
      : "Đây là một số sản phẩm N&L Store đang bán nổi bật hiện nay.";

    return this.createResponse(reply, products, ["Tư vấn kích thước", "Phí vận chuyển", "Chính sách đổi trả"]);
  }

  async handleOrders(user) {
    if (!user?.id) {
      return this.createResponse("Bạn vui lòng đăng nhập để tôi kiểm tra đơn hàng của chính tài khoản bạn.", [], ["Đăng nhập", "Hướng dẫn đặt hàng"]);
    }

    let orders = [];

    try {
      orders = await this.repository.getRecentOrdersByCustomer(user.id, 5);
    } catch {
      return this.createResponse(TEMPORARY_ERROR_REPLY, [], ["Kiểm tra đơn hàng", "Liên hệ cửa hàng"]);
    }
    if (!orders.length) {
      return this.createResponse("Tài khoản của bạn hiện chưa có đơn hàng nào gần đây.", [], ["Sản phẩm đang bán", "Hướng dẫn đặt hàng"]);
    }

    const reply = `Tôi tìm thấy ${orders.length} đơn hàng gần nhất của bạn. Bạn có thể xem chi tiết đầy đủ trong mục Đơn hàng.`;
    return {
      ...this.createResponse(reply, [], ["Xem đơn hàng", "Phí vận chuyển"]),
      orders
    };
  }

  createResponse(reply, products = [], suggestions = []) {
    return {
      success: true,
      reply,
      products: products.slice(0, 5),
      suggestions: suggestions.slice(0, 6)
    };
  }
}

function normalizeMessage(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

function normalizeVietnamese(value) {
  return normalizeMessage(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function detectIntent(message) {
  const text = normalizeVietnamese(message);

  if (/(don hang|order|kiem tra don|trang thai don|xem don)/.test(text)) {
    if (/(nguoi khac|tai khoan khac|khach hang khac|user khac)/.test(text)) return "unsafe_order_request";
    return "orders";
  }

  if (/(size|kich thuoc|cao|can nang|1m|kg|so do)/.test(text)) return "size";
  if (/(phi van chuyen|ship|shipping|giao hang bao nhieu)/.test(text)) return "shipping_fee";
  if (/(thoi gian giao|bao lau|may ngay|khi nao nhan)/.test(text)) return "delivery_time";
  if (/(doi tra|tra hang|doi hang|hoan tra)/.test(text)) return "return_policy";
  if (/(thanh toan|payment|cod|vnpay|momo)/.test(text)) return "payment";
  if (/(bao hanh|warranty)/.test(text)) return "warranty";
  if (/(lien he|hotline|email|dia chi)/.test(text)) return "contact";
  if (/(dat hang|mua hang|huong dan mua)/.test(text)) return "ordering";
  if (/(san pham|tim|ao|quan|vay|dam|tui|giay|dong ho|trang suc|kinh|mu|non|duoi|mau|gia|ban nhung gi)/.test(text)) return "products";

  return "unknown";
}

function getPolicyReply(intent) {
  if (intent === "ordering") {
    return "Bạn chọn sản phẩm, bấm thêm vào giỏ hàng hoặc mua ngay, đăng nhập, nhập địa chỉ nhận hàng rồi xác nhận thanh toán. Chatbot chỉ hướng dẫn và tra cứu, không tự tạo đơn hàng giúp bạn.";
  }
  return POLICIES[intent] || "";
}

function extractProductCriteria(message) {
  const normalized = normalizeVietnamese(message);
  const raw = normalizeMessage(message);
  const colors = ["den", "trang", "hong", "do", "xanh", "vang", "be", "nau", "xam", "kem", "tim"];
  const categories = ["ao", "quan", "vay", "dam", "tui", "giay", "dong ho", "trang suc", "kinh", "mu", "non", "phu kien"];
  const sizes = ["xs", "s", "m", "l", "xl", "xxl", "2xl", "3xl"];
  const priceMax = extractPriceMax(normalized);
  const keywords = [];

  categories.forEach((item) => {
    if (normalized.includes(item)) keywords.push(item);
  });

  const color = colors.find((item) => normalized.includes(`mau ${item}`) || normalized.includes(item)) || "";
  const size = sizes.find((item) => new RegExp(`\\b${item}\\b`, "i").test(normalized)) || "";
  const quotedWords = raw.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length >= 3).slice(0, 4);

  if (!keywords.length && !color && !size && !priceMax) {
    keywords.push(...quotedWords);
  }

  return {
    keywords: [...new Set(keywords)].slice(0, 4),
    color,
    size,
    priceMax,
    hasCriteria: Boolean(keywords.length || color || size || priceMax)
  };
}

function extractPriceMax(normalized) {
  const match = normalized.match(/(?:duoi|nho hon|toi da)\s*([\d.,]+)\s*(k|nghin|trieu|000)?/);
  if (!match) return null;

  const base = Number(String(match[1]).replace(/[.,]/g, ""));
  if (!Number.isFinite(base) || base <= 0) return null;

  const unit = match[2] || "";
  if (unit === "trieu") return base * 1000000;
  if (unit === "k" || unit === "nghin") return base * 1000;
  return base < 10000 ? base * 1000 : base;
}

function defaultSuggestions() {
  return ["Tìm sản phẩm", "Tư vấn kích thước", "Sản phẩm đang bán", "Phí vận chuyển", "Chính sách đổi trả", "Kiểm tra đơn hàng"];
}
