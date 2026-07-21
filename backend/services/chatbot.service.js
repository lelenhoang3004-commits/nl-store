import { ChatbotRepository } from "../repositories/chatbot.repository.js";

const FALLBACK_REPLY = "Xin lỗi, tôi chưa tìm thấy thông tin phù hợp. Bạn có thể hỏi về sản phẩm, voucher, size, giao hàng, thanh toán, đăng nhập hoặc kiểm tra đơn hàng nhé.";
const TEMPORARY_ERROR_REPLY = "Xin lỗi, hệ thống đang tạm thời gặp sự cố. Bạn vui lòng thử lại sau ít phút.";

const FAQ = Object.freeze({
  login: {
    reply: "Bạn bấm Đăng nhập ở góc trên website, nhập email và mật khẩu hoặc dùng phương thức đăng nhập đang được hỗ trợ. Nếu chưa có tài khoản, bạn có thể chuyển sang mục Đăng ký.",
    suggestions: ["Cách đăng ký tài khoản", "Kiểm tra đơn hàng", "Sản phẩm đang bán"]
  },
  register: {
    reply: "Bạn bấm Đăng ký, nhập thông tin tài khoản theo biểu mẫu rồi xác nhận. Sau khi đăng ký, hãy đăng nhập để đặt hàng, lưu giỏ hàng và theo dõi đơn.",
    suggestions: ["Cách đăng nhập", "Hướng dẫn đặt hàng", "Tìm sản phẩm"]
  },
  ordering: {
    reply: "Bạn chọn sản phẩm, bấm thêm vào giỏ hàng hoặc mua ngay, đăng nhập, nhập địa chỉ nhận hàng rồi xác nhận thanh toán. Chatbot chỉ hướng dẫn và tra cứu, không tự tạo đơn hàng giúp bạn.",
    suggestions: ["Phí vận chuyển", "Thanh toán", "Kiểm tra đơn hàng"]
  },
  shipping_fee: {
    reply: "Phí vận chuyển sẽ được website tính ở bước thanh toán theo địa chỉ nhận hàng và phương thức giao hàng. Bạn có thể thêm sản phẩm vào giỏ rồi mở trang thanh toán để xem phí chính xác.",
    suggestions: ["Thời gian giao hàng", "Hướng dẫn đặt hàng", "Voucher hiện có"]
  },
  delivery_time: {
    reply: "Thời gian giao hàng phụ thuộc địa chỉ nhận hàng và đơn vị vận chuyển. Shop sẽ cập nhật trạng thái đơn sau khi xác nhận và bàn giao cho vận chuyển.",
    suggestions: ["Kiểm tra đơn hàng", "Phí vận chuyển", "Chính sách đổi trả"]
  },
  return_policy: {
    reply: "Bạn có thể liên hệ N&L Store để được hỗ trợ đổi trả khi sản phẩm còn nguyên tình trạng theo quy định của shop. Điều kiện chi tiết nên được xác nhận với nhân viên theo từng sản phẩm và thời điểm mua.",
    suggestions: ["Liên hệ cửa hàng", "Sản phẩm đang bán", "Kiểm tra đơn hàng"]
  },
  payment: {
    reply: "N&L Store hỗ trợ các phương thức thanh toán đang hiển thị ở bước thanh toán, thường gồm thanh toán khi nhận hàng và các cổng thanh toán trực tuyến nếu đang được bật.",
    suggestions: ["Hướng dẫn đặt hàng", "Voucher hiện có", "Phí vận chuyển"]
  },
  warranty: {
    reply: "Chính sách bảo hành phụ thuộc từng nhóm sản phẩm. Bạn vui lòng liên hệ nhân viên N&L Store để được xác nhận điều kiện bảo hành cụ thể.",
    suggestions: ["Liên hệ cửa hàng", "Chính sách đổi trả", "Tìm sản phẩm"]
  },
  contact: {
    reply: "Bạn có thể liên hệ N&L Store qua các kênh hiển thị trên website hoặc gửi yêu cầu hỗ trợ trực tiếp cho nhân viên cửa hàng.",
    suggestions: ["Chính sách đổi trả", "Kiểm tra đơn hàng", "Sản phẩm mới"]
  },
  size: {
    reply: "Để tư vấn size chính xác hơn, bạn cho tôi chiều cao, cân nặng, loại sản phẩm muốn mua và nếu có thì thêm số đo vai, ngực, eo hoặc hông nhé.",
    suggestions: ["Tìm áo size M", "Tìm sản phẩm", "Sản phẩm mới"]
  }
});

const INTENT_KEYWORDS = Object.freeze({
  login: ["dang nhap", "login", "tai khoan", "mat khau", "quen mat khau"],
  register: ["dang ky", "tao tai khoan", "register"],
  ordering: ["dat hang", "mua hang", "huong dan mua", "them vao gio"],
  shipping_fee: ["phi van chuyen", "tien ship", "ship", "shipping"],
  delivery_time: ["thoi gian giao", "bao lau", "may ngay", "khi nao nhan", "giao hang"],
  return_policy: ["doi tra", "tra hang", "doi hang", "hoan tra"],
  payment: ["thanh toan", "payment", "cod", "vnpay", "momo", "chuyen khoan"],
  warranty: ["bao hanh", "warranty"],
  contact: ["lien he", "hotline", "email", "dia chi", "nhan vien"],
  size: ["size", "kich thuoc", "cao", "can nang", "1m", "kg", "so do"],
  vouchers: ["voucher", "ma giam", "giam gia", "khuyen mai", "coupon", "uu dai"],
  orders: ["don hang", "order", "kiem tra don", "trang thai don", "xem don"],
  best_sellers: ["ban chay", "hot", "pho bien", "mua nhieu"],
  new_products: ["san pham moi", "hang moi", "moi ve", "new arrival"],
  products: ["san pham", "tim", "ao", "quan", "vay", "dam", "tui", "giay", "dong ho", "trang suc", "kinh", "mu", "non", "gia", "ton kho", "mau"]
});

export class ChatbotService {
  constructor(repository = new ChatbotRepository()) {
    this.repository = repository;
  }

  async replyToMessage({ message, user }) {
    const cleanMessage = normalizeMessage(message);
    if (!cleanMessage) {
      return this.createResponse("Bạn vui lòng nhập nội dung cần hỗ trợ nhé.", [], defaultSuggestions());
    }

    const normalized = normalizeVietnamese(cleanMessage);
    const intent = detectIntent(normalized);

    if (intent === "unsafe_order_request") {
      return this.createResponse("Tôi không thể hiển thị đơn hàng của tài khoản khác. Bạn chỉ có thể xem đơn hàng của chính tài khoản đang đăng nhập.", [], ["Kiểm tra đơn hàng", "Chính sách đổi trả"]);
    }

    if (intent === "orders") return this.handleOrders(user);
    if (intent === "vouchers") return this.handleVouchers();
    if (intent === "best_sellers") return this.handleProductList("best_sellers", cleanMessage);
    if (intent === "new_products") return this.handleProductList("new_products", cleanMessage);
    if (intent === "products") return this.handleProductList("products", cleanMessage);
    if (FAQ[intent]) return this.createResponse(FAQ[intent].reply, [], FAQ[intent].suggestions);

    return this.createResponse(FALLBACK_REPLY, [], suggestNearQuestions(normalized));
  }

  async handleProductList(intent, message) {
    const criteria = extractProductCriteria(message);
    let products = [];

    try {
      if (intent === "best_sellers") {
        products = await this.repository.getBestSellingProducts(5);
      } else if (intent === "new_products") {
        products = await this.repository.getNewProducts(5);
      } else if (criteria.hasCriteria) {
        products = await this.repository.searchProducts(criteria);
      } else {
        products = await this.repository.getActiveProductSamples(5);
      }
    } catch {
      return this.createResponse(TEMPORARY_ERROR_REPLY, [], defaultSuggestions());
    }

    if (!products.length) {
      return this.createResponse("Tôi chưa tìm thấy sản phẩm phù hợp. Bạn thử nói rõ hơn về tên sản phẩm, màu, size, danh mục hoặc khoảng giá nhé.", [], ["Tìm áo màu đen", "Sản phẩm mới", "Sản phẩm bán chạy"]);
    }

    const replies = {
      best_sellers: "Đây là một số sản phẩm bán chạy của N&L Store.",
      new_products: "Đây là một số sản phẩm mới của N&L Store.",
      products: criteria.hasCriteria
        ? `Tôi tìm thấy ${products.length} sản phẩm phù hợp nhất với nhu cầu của bạn.`
        : "Đây là một số sản phẩm N&L Store đang bán nổi bật hiện nay."
    };

    return this.createResponse(replies[intent] || replies.products, products, ["Voucher hiện có", "Tư vấn size", "Phí vận chuyển"]);
  }

  async handleVouchers() {
    let vouchers = [];
    try {
      vouchers = await this.repository.getActiveVouchers(5);
    } catch {
      return this.createResponse(TEMPORARY_ERROR_REPLY, [], ["Sản phẩm đang bán", "Thanh toán"]);
    }

    if (!vouchers.length) {
      return this.createResponse("Hiện tôi chưa thấy voucher khả dụng trong hệ thống. Bạn có thể kiểm tra lại ở giỏ hàng hoặc theo dõi các chương trình mới của shop.", [], ["Sản phẩm mới", "Sản phẩm bán chạy"]);
    }

    return {
      ...this.createResponse("Đây là các voucher đang khả dụng trong hệ thống N&L Store.", [], ["Sản phẩm đang bán", "Hướng dẫn đặt hàng", "Thanh toán"]),
      vouchers
    };
  }

  async handleOrders(user) {
    if (!user?.id) {
      return this.createResponse("Bạn vui lòng đăng nhập để tôi kiểm tra đơn hàng của chính tài khoản bạn. Nếu chỉ cần hướng dẫn, bạn có thể vào mục Đơn hàng sau khi đăng nhập.", [], ["Cách đăng nhập", "Hướng dẫn đặt hàng"]);
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

    return {
      ...this.createResponse(`Tôi tìm thấy ${orders.length} đơn hàng gần nhất của bạn. Bạn có thể xem chi tiết đầy đủ trong mục Đơn hàng.`, [], ["Xem đơn hàng", "Phí vận chuyển"]),
      orders
    };
  }

  createResponse(reply, products = [], suggestions = []) {
    return {
      success: true,
      reply,
      products: products.slice(0, 5),
      suggestions: suggestions.slice(0, 8)
    };
  }
}

function normalizeMessage(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000);
}

function normalizeVietnamese(value) {
  return normalizeMessage(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function detectIntent(normalized) {
  if (/(don hang|order|kiem tra don|trang thai don|xem don)/.test(normalized)) {
    if (/(nguoi khac|tai khoan khac|khach hang khac|user khac)/.test(normalized)) return "unsafe_order_request";
    return "orders";
  }

  const scores = Object.entries(INTENT_KEYWORDS).map(([intent, keywords]) => ({
    intent,
    score: keywords.reduce((total, keyword) => total + (normalized.includes(keyword) ? 1 : 0), 0)
  })).sort((a, b) => b.score - a.score);

  return scores[0]?.score > 0 ? scores[0].intent : "unknown";
}

function extractProductCriteria(message) {
  const normalized = normalizeVietnamese(message);
  const colors = [
    ["đen", "den"], ["trắng", "trang"], ["hồng", "hong"], ["đỏ", "do"], ["xanh", "xanh"],
    ["vàng", "vang"], ["be", "be"], ["nâu", "nau"], ["xám", "xam"], ["kem", "kem"], ["tím", "tim"]
  ];
  const categories = ["ao", "quan", "vay", "dam", "tui", "giay", "dong ho", "trang suc", "kinh", "mu", "non", "phu kien"];
  const sizes = ["xs", "s", "m", "l", "xl", "xxl", "2xl", "3xl", "free size", "freesize"];
  const priceMax = extractPriceMax(normalized);
  const priceMin = extractPriceMin(normalized);
  const keywords = [];

  categories.forEach((item) => {
    if (normalized.includes(item)) keywords.push(item);
  });

  const colorPair = colors.find(([, plain]) => normalized.includes(`mau ${plain}`) || normalized.includes(plain));
  const color = colorPair?.[1] || "";
  const size = sizes.find((item) => new RegExp(`\\b${item}\\b`, "i").test(normalized)) || "";

  if (/(gia|bao nhieu|ton kho|con hang|het hang)/.test(normalized) && !keywords.length) {
    const descriptiveWords = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length >= 3 && !["gia", "bao", "nhieu", "hang", "ton", "kho"].includes(word));
    keywords.push(...descriptiveWords.slice(0, 4));
  }

  return {
    keywords: [...new Set(keywords)].slice(0, 5),
    color,
    size,
    priceMin,
    priceMax,
    hasCriteria: Boolean(keywords.length || color || size || priceMin || priceMax)
  };
}

function extractPriceMax(normalized) {
  const match = normalized.match(/(?:duoi|nho hon|toi da|<=?)\s*([\d.,]+)\s*(k|nghin|trieu|000)?/);
  return parsePriceMatch(match);
}

function extractPriceMin(normalized) {
  const match = normalized.match(/(?:tren|lon hon|tu)\s*([\d.,]+)\s*(k|nghin|trieu|000)?/);
  return parsePriceMatch(match);
}

function parsePriceMatch(match) {
  if (!match) return null;
  const base = Number(String(match[1]).replace(/[.,]/g, ""));
  if (!Number.isFinite(base) || base <= 0) return null;
  const unit = match[2] || "";
  if (unit === "trieu") return base * 1000000;
  if (unit === "k" || unit === "nghin") return base * 1000;
  return base < 10000 ? base * 1000 : base;
}

function suggestNearQuestions(normalized) {
  if (/(sale|coupon|ma)/.test(normalized)) return ["Voucher hiện có", "Sản phẩm bán chạy", "Thanh toán"];
  if (/(ship|giao)/.test(normalized)) return ["Phí vận chuyển", "Thời gian giao hàng", "Kiểm tra đơn hàng"];
  if (/(ao|quan|tui|vay|dam|giay)/.test(normalized)) return ["Tìm sản phẩm", "Sản phẩm mới", "Sản phẩm bán chạy"];
  return defaultSuggestions();
}

function defaultSuggestions() {
  return ["Tìm sản phẩm", "Sản phẩm mới", "Sản phẩm bán chạy", "Voucher hiện có", "Tư vấn size", "Phí vận chuyển", "Thanh toán", "Kiểm tra đơn hàng"];
}
