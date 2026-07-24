import { ChatbotRepository } from "../repositories/chatbot.repository.js";

const DEFAULT_SUGGESTIONS = ["Tìm sản phẩm", "Sản phẩm mới", "Sản phẩm bán chạy", "Voucher hiện có", "Kiểm tra đơn hàng", "Phí vận chuyển", "Thanh toán", "Đổi trả"];
const FALLBACK_REPLY = "Mình chưa hiểu thật chính xác ý bạn. Bạn có thể hỏi về sản phẩm, voucher, đơn hàng, thanh toán, vận chuyển, đổi trả, bảo hành, tài khoản hoặc liên hệ hỗ trợ nhé.";
const TEMPORARY_ERROR_REPLY = "Xin lỗi, hệ thống đang tạm thời gặp sự cố. Bạn vui lòng thử lại sau ít phút.";

const FAQ = Object.freeze({
  greeting: { reply: "Xin chào, mình là trợ lý N&L Store. Mình có thể giúp bạn tìm sản phẩm, xem voucher, hướng dẫn đặt hàng, thanh toán, vận chuyển và chính sách đổi trả.", suggestions: ["Tìm sản phẩm", "Sản phẩm mới", "Voucher hiện có", "Tư vấn size"] },
  thanks: { reply: "Rất vui được hỗ trợ bạn. Nếu cần thêm thông tin về sản phẩm, đơn hàng hoặc voucher, bạn cứ nhắn mình nhé.", suggestions: ["Sản phẩm bán chạy", "Voucher hiện có", "Liên hệ hỗ trợ"] },
  goodbye: { reply: "Cảm ơn bạn đã ghé N&L Store. Chúc bạn mua sắm vui vẻ và tìm được món thật ưng ý nhé.", suggestions: ["Sản phẩm mới", "Voucher hiện có", "Liên hệ hỗ trợ"] },
  login: { reply: "Bạn bấm Đăng nhập ở header, nhập email và mật khẩu hoặc dùng phương thức đăng nhập đang được hỗ trợ. Nếu quên mật khẩu, hãy chọn Quên mật khẩu để nhận hướng dẫn đặt lại.", suggestions: ["Đăng ký tài khoản", "Quên mật khẩu", "Kiểm tra đơn hàng"] },
  register: { reply: "Bạn vào mục Đăng ký, nhập thông tin tài khoản rồi xác nhận. Sau khi đăng ký, bạn có thể đăng nhập để đặt hàng, lưu yêu thích và theo dõi đơn.", suggestions: ["Đăng nhập", "Hướng dẫn đặt hàng", "Tìm sản phẩm"] },
  account_help: { reply: "Bạn có thể cập nhật hồ sơ, địa chỉ và thông tin cá nhân trong mục Hồ sơ sau khi đăng nhập. Với đổi mật khẩu hoặc quên mật khẩu, hãy dùng chức năng bảo mật tương ứng trên trang tài khoản.", suggestions: ["Đăng nhập", "Quên mật khẩu", "Kiểm tra đơn hàng"] },
  ordering: { reply: "Bạn chọn sản phẩm, bấm Thêm vào giỏ hoặc Mua ngay, đăng nhập, nhập địa chỉ nhận hàng rồi xác nhận thanh toán. Chatbot chỉ hướng dẫn và tra cứu, không tự tạo đơn hàng giúp bạn.", suggestions: ["Phí vận chuyển", "Thanh toán", "Voucher hiện có"] },
  shipping_fee: { reply: "Phí vận chuyển được tính ở bước thanh toán theo địa chỉ nhận hàng và phương thức giao hàng. Bạn có thể thêm sản phẩm vào giỏ rồi mở trang thanh toán để xem phí chính xác.", suggestions: ["Thời gian giao hàng", "Khu vực giao hàng", "Theo dõi vận đơn"] },
  delivery_time: { reply: "Thời gian giao hàng phụ thuộc địa chỉ nhận hàng và đơn vị vận chuyển. Sau khi đơn được xác nhận và bàn giao, bạn có thể theo dõi trạng thái trong mục Đơn hàng.", suggestions: ["Kiểm tra đơn hàng", "Phí vận chuyển", "Theo dõi vận đơn"] },
  shipping_area: { reply: "N&L Store xử lý giao hàng theo khu vực được hỗ trợ ở bước thanh toán. Nếu địa chỉ chưa hiển thị phí hoặc phương thức giao phù hợp, bạn hãy liên hệ hỗ trợ để được kiểm tra thêm.", suggestions: ["Phí vận chuyển", "Thời gian giao hàng", "Liên hệ hỗ trợ"] },
  tracking: { reply: "Bạn có thể theo dõi trạng thái đơn trong mục Đơn hàng. Khi có mã vận đơn hoặc trạng thái giao hàng mới, hệ thống sẽ cập nhật tại trang chi tiết đơn nếu dữ liệu vận chuyển đã sẵn sàng.", suggestions: ["Kiểm tra đơn hàng", "Thời gian giao hàng", "Liên hệ hỗ trợ"] },
  return_policy: { reply: "N&L Store hỗ trợ đổi trả theo điều kiện của shop: sản phẩm còn nguyên tình trạng, đầy đủ thông tin đơn hàng và nằm trong thời gian hỗ trợ. Với từng sản phẩm cụ thể, bạn nên liên hệ nhân viên để được xác nhận chính xác.", suggestions: ["Điều kiện đổi trả", "Liên hệ hỗ trợ", "Bảo hành"] },
  warranty: { reply: "Chính sách bảo hành phụ thuộc từng nhóm sản phẩm. Bạn hãy cung cấp mã đơn hoặc tên sản phẩm cho nhân viên N&L Store để được kiểm tra điều kiện bảo hành cụ thể.", suggestions: ["Liên hệ hỗ trợ", "Đổi trả", "Kiểm tra đơn hàng"] },
  payment: { reply: "Các phương thức thanh toán sẽ hiển thị ở bước thanh toán, thường gồm thanh toán khi nhận hàng và các cổng trực tuyến nếu đang được bật. Bạn có thể chọn phương thức phù hợp trước khi xác nhận đơn.", suggestions: ["Thanh toán khi nhận hàng", "MoMo", "Chuyển khoản", "Thanh toán thất bại"] },
  payment_failed: { reply: "Nếu thanh toán thất bại, bạn hãy kiểm tra số dư, kết nối mạng và trạng thái giao dịch. Nếu đơn chưa được ghi nhận thanh toán, bạn có thể thử lại hoặc chọn phương thức khác ở bước thanh toán.", suggestions: ["Thanh toán", "Kiểm tra đơn hàng", "Liên hệ hỗ trợ"] },
  cod: { reply: "Nếu phương thức thanh toán khi nhận hàng đang được bật cho đơn của bạn, bạn có thể chọn tại bước thanh toán và trả tiền khi nhận hàng.", suggestions: ["Thanh toán", "Phí vận chuyển", "Hướng dẫn đặt hàng"] },
  bank_transfer: { reply: "Với chuyển khoản, bạn hãy làm theo thông tin thanh toán hiển thị ở bước checkout. Sau khi chuyển, trạng thái đơn sẽ được cập nhật theo quy trình xác nhận của shop.", suggestions: ["Thanh toán", "Kiểm tra đơn hàng", "Liên hệ hỗ trợ"] },
  momo: { reply: "Nếu MoMo đang được bật trong hệ thống, bạn có thể chọn MoMo ở bước thanh toán và làm theo hướng dẫn trên màn hình. Nếu giao dịch lỗi, hãy thử lại hoặc chọn phương thức khác.", suggestions: ["Thanh toán thất bại", "Thanh toán", "Liên hệ hỗ trợ"] },
  contact: { reply: "Bạn có thể liên hệ N&L Store qua các kênh hỗ trợ hiển thị trên website. Nếu cần xử lý đơn hàng, hãy chuẩn bị mã đơn để nhân viên kiểm tra nhanh hơn.", suggestions: ["Kiểm tra đơn hàng", "Đổi trả", "Bảo hành"] },
  working_hours: { reply: "Thời gian hỗ trợ cụ thể sẽ theo thông tin cửa hàng hiển thị trên website. Nếu ngoài giờ, bạn vẫn có thể để lại yêu cầu và shop sẽ phản hồi khi có nhân viên trực.", suggestions: ["Liên hệ hỗ trợ", "Kiểm tra đơn hàng", "Tìm sản phẩm"] },
  size: { reply: "Để tư vấn size chính xác hơn, bạn cho mình chiều cao, cân nặng, loại sản phẩm muốn mua và nếu có thì thêm số đo vai, ngực, eo hoặc hông nhé.", suggestions: ["Tìm áo size M", "Tìm quần jeans", "Liên hệ hỗ trợ"] },
  voucher_condition: { reply: "Điều kiện voucher thường gồm đơn tối thiểu, thời hạn áp dụng, số lượng còn lại và nhóm sản phẩm hợp lệ. Nếu hệ thống có voucher khả dụng, mình sẽ hiển thị mã và mức giảm để bạn kiểm tra thêm ở giỏ hàng.", suggestions: ["Voucher hiện có", "Đơn tối thiểu", "Sản phẩm bán chạy"] }
});

const INTENT_KEYWORDS = Object.freeze({
  greeting: ["xin chao", "chao", "hello", "alo", "ban oi"],
  thanks: ["cam on", "thanks", "thank you", "tot qua"],
  goodbye: ["tam biet", "bye", "hen gap", "chao shop"],
  login: ["dang nhap", "login", "quen mat khau", "mat khau"],
  register: ["dang ky", "tao tai khoan", "register"],
  account_help: ["tai khoan", "ho so", "cap nhat ho so", "doi mat khau", "thong tin ca nhan"],
  ordering: ["dat hang", "mua hang", "huong dan mua", "them vao gio", "mua ngay"],
  shipping_fee: ["phi van chuyen", "tien ship", "phi ship", "shipping fee"],
  delivery_time: ["thoi gian giao", "bao lau", "may ngay", "khi nao nhan", "giao hang mat bao lau"],
  shipping_area: ["khu vuc giao", "giao o dau", "co giao", "toan quoc"],
  tracking: ["van don", "ma van don", "theo doi", "tracking", "dang giao"],
  return_policy: ["doi tra", "tra hang", "doi hang", "hoan tra", "dieu kien doi tra"],
  warranty: ["bao hanh", "warranty"],
  payment_failed: ["thanh toan that bai", "loi thanh toan", "giao dich loi", "khong thanh toan duoc"],
  cod: ["cod", "thanh toan khi nhan", "nhan hang tra tien"],
  bank_transfer: ["chuyen khoan", "bank", "ngan hang"],
  momo: ["momo", "vi momo"],
  payment: ["thanh toan", "payment", "phuong thuc thanh toan", "vnpay"],
  contact: ["lien he", "hotline", "email", "dia chi", "ho tro", "nhan vien"],
  working_hours: ["gio lam", "mo cua", "dong cua", "may gio"],
  size: ["size", "kich thuoc", "cao", "can nang", "1m", "kg", "so do"],
  voucher_condition: ["dieu kien voucher", "don toi thieu", "han voucher", "con han", "phan tram giam", "ap dung voucher"],
  vouchers: ["voucher", "ma giam", "giam gia", "khuyen mai", "coupon", "uu dai", "sale"],
  orders: ["don hang", "order", "kiem tra don", "trang thai don", "xem don", "dang xu ly", "hoan thanh", "da huy"],
  best_sellers: ["ban chay", "hot", "pho bien", "mua nhieu"],
  new_products: ["san pham moi", "hang moi", "moi ve", "new arrival", "new products"],
  products: ["san pham", "tim", "ao nam", "ao nu", "ao khoac", "ao len", "quan jeans", "chan vay", "tui xach", "dong ho", "kinh mat", "trang suc", "mu non", "phu kien", "ao", "quan", "vay", "dam", "tui", "giay", "gia", "ton kho", "con hang", "het hang"]
});

export class ChatbotService {
  constructor(repository = new ChatbotRepository()) {
    this.repository = repository;
  }

  async replyToMessage({ message, user }) {
    const cleanMessage = normalizeMessage(message);
    if (!cleanMessage) return this.createResponse("Bạn vui lòng nhập nội dung cần hỗ trợ nhé.", [], defaultSuggestions());

    const normalized = normalizeVietnamese(cleanMessage);
    const intent = detectIntent(normalized);

    if (intent === "unsafe_order_request") return this.createResponse("Mình không thể hiển thị đơn hàng của tài khoản khác. Bạn chỉ có thể xem đơn hàng của chính tài khoản đang đăng nhập.", [], ["Kiểm tra đơn hàng", "Liên hệ hỗ trợ"]);
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
      if (intent === "best_sellers") products = await this.repository.getBestSellingProducts(5);
      else if (intent === "new_products") products = await this.repository.getNewProducts(5);
      else if (criteria.hasCriteria) products = await this.repository.searchProducts(criteria);
      else products = await this.repository.getActiveProductSamples(5);
    } catch {
      return this.createResponse(TEMPORARY_ERROR_REPLY, [], defaultSuggestions());
    }

    if (!products.length) return this.createResponse("Mình chưa tìm thấy sản phẩm phù hợp. Bạn thử nói rõ hơn tên sản phẩm, danh mục, màu, size hoặc khoảng giá nhé.", [], ["Áo khoác", "Quần jeans", "Phụ kiện", "Sản phẩm mới"]);

    const replies = {
      best_sellers: "Đây là một số sản phẩm bán chạy của N&L Store.",
      new_products: "Đây là một số sản phẩm mới của N&L Store.",
      products: criteria.hasCriteria ? `Mình tìm thấy ${products.length} sản phẩm phù hợp nhất với nhu cầu của bạn.` : "Đây là một số sản phẩm nổi bật N&L Store đang bán."
    };
    return this.createResponse(replies[intent] || replies.products, products, ["Voucher hiện có", "Tư vấn size", "Phí vận chuyển", "Sản phẩm bán chạy"]);
  }

  async handleVouchers() {
    let vouchers = [];
    try {
      vouchers = await this.repository.getActiveVouchers(5);
    } catch {
      return this.createResponse(TEMPORARY_ERROR_REPLY, [], ["Sản phẩm mới", "Thanh toán", "Liên hệ hỗ trợ"]);
    }
    if (!vouchers.length) return this.createResponse("Hiện mình chưa thấy voucher khả dụng trong hệ thống. Bạn có thể kiểm tra lại ở giỏ hàng hoặc theo dõi các chương trình mới của shop.", [], ["Sản phẩm mới", "Sản phẩm bán chạy", "Điều kiện voucher"]);
    return { ...this.createResponse("Đây là các voucher đang khả dụng trong hệ thống N&L Store. Bạn nhớ kiểm tra đơn tối thiểu, thời hạn và số lượng còn lại trước khi áp dụng nhé.", [], ["Điều kiện voucher", "Sản phẩm bán chạy", "Thanh toán"]), vouchers };
  }

  async handleOrders(user) {
    if (!user?.id) return this.createResponse("Bạn vui lòng đăng nhập để mình kiểm tra đơn hàng của tài khoản bạn. Nếu chỉ cần hướng dẫn, bạn có thể vào mục Đơn hàng sau khi đăng nhập để xem trạng thái xử lý, đang giao, hoàn thành hoặc đã hủy.", [], ["Đăng nhập", "Hướng dẫn xem đơn hàng", "Liên hệ hỗ trợ"]);
    let orders = [];
    try {
      orders = await this.repository.getRecentOrdersByCustomer(user.id, 5);
    } catch {
      return this.createResponse(TEMPORARY_ERROR_REPLY, [], ["Kiểm tra đơn hàng", "Liên hệ hỗ trợ"]);
    }
    if (!orders.length) return this.createResponse("Tài khoản của bạn hiện chưa có đơn hàng nào gần đây.", [], ["Sản phẩm mới", "Hướng dẫn đặt hàng", "Voucher hiện có"]);
    return { ...this.createResponse(`Mình tìm thấy ${orders.length} đơn hàng gần nhất của bạn. Bạn có thể xem chi tiết đầy đủ trong mục Đơn hàng.`, [], ["Theo dõi vận đơn", "Phí vận chuyển", "Liên hệ hỗ trợ"]), orders };
  }

  createResponse(reply, products = [], suggestions = []) {
    return { success: true, reply, products: products.slice(0, 5), suggestions: suggestions.slice(0, 8) };
  }
}

function normalizeMessage(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000);
}

function normalizeVietnamese(value) {
  return normalizeMessage(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

function detectIntent(normalized) {
  if (/(don hang|order|kiem tra don|trang thai don|xem don)/.test(normalized)) {
    if (/(nguoi khac|tai khoan khac|khach hang khac|user khac)/.test(normalized)) return "unsafe_order_request";
    return "orders";
  }
  const scores = Object.entries(INTENT_KEYWORDS).map(([intent, keywords]) => ({ intent, score: keywords.reduce((total, keyword) => total + (matchesKeyword(normalized, keyword) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
  return scores[0]?.score > 0 ? scores[0].intent : "unknown";
}

function matchesKeyword(normalized, keyword) {
  const value = String(keyword || "").trim();
  if (!value) return false;
  if (value.length <= 3 && /^[a-z0-9]+$/i.test(value)) return normalized.split(/[^a-z0-9]+/).includes(value);
  return normalized.includes(value);
}

function extractProductCriteria(message) {
  const normalized = normalizeVietnamese(message);
  const colors = ["den", "trang", "hong", "do", "xanh", "vang", "be", "nau", "xam", "kem", "tim"];
  const categories = ["ao nam", "ao nu", "ao khoac", "ao len", "quan jeans", "chan vay", "tui xach", "dong ho", "kinh mat", "trang suc", "mu non", "phu kien", "ao", "quan", "vay", "dam", "tui", "giay"];
  const sizes = ["xs", "s", "m", "l", "xl", "xxl", "2xl", "3xl", "free size", "freesize"];
  const priceMax = extractPriceMax(normalized);
  const priceMin = extractPriceMin(normalized);
  const keywords = [];
  categories.forEach((item) => { if (normalized.includes(item)) keywords.push(item); });
  const color = colors.find((item) => normalized.includes(`mau ${item}`) || normalized.includes(item)) || "";
  const size = sizes.find((item) => new RegExp(`\\b${item}\\b`, "i").test(normalized)) || "";
  if (/(gia|bao nhieu|ton kho|con hang|het hang)/.test(normalized) && !keywords.length) {
    const descriptiveWords = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((word) => word.length >= 3 && !["gia", "bao", "nhieu", "hang", "ton", "kho", "con", "het"].includes(word));
    keywords.push(...descriptiveWords.slice(0, 4));
  }
  return { keywords: [...new Set(keywords)].slice(0, 5), color, size, priceMin, priceMax, hasCriteria: Boolean(keywords.length || color || size || priceMin || priceMax) };
}

function extractPriceMax(normalized) {
  return parsePriceMatch(normalized.match(/(?:duoi|nho hon|toi da|<=?)\s*([\d.,]+)\s*(k|nghin|trieu|000)?/));
}

function extractPriceMin(normalized) {
  return parsePriceMatch(normalized.match(/(?:tren|lon hon|tu)\s*([\d.,]+)\s*(k|nghin|trieu|000)?/));
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
  if (/(sale|coupon|ma|voucher)/.test(normalized)) return ["Voucher hiện có", "Điều kiện voucher", "Sản phẩm bán chạy"];
  if (/(ship|giao|van chuyen)/.test(normalized)) return ["Phí vận chuyển", "Thời gian giao hàng", "Theo dõi vận đơn"];
  if (/(ao|quan|tui|vay|dam|giay|dong ho|phu kien)/.test(normalized)) return ["Tìm sản phẩm", "Sản phẩm mới", "Sản phẩm bán chạy"];
  if (/(tai khoan|mat khau|dang nhap)/.test(normalized)) return ["Đăng nhập", "Quên mật khẩu", "Đăng ký tài khoản"];
  return defaultSuggestions();
}

function defaultSuggestions() {
  return DEFAULT_SUGGESTIONS;
}