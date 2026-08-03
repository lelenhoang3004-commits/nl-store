import { SUPPORTED_CHECKOUT_PAYMENT_METHODS } from "../../../admin/utils/payment-formatters.js";

const footerColumns = [
  {
    title: "Danh mục",
    links: [
      { label: "Sản phẩm mới", route: "new-arrival" },
      { label: "Bán chạy", route: "best-seller" },
      { label: "Ưu đãi", route: "flash-sale" },
      { label: "Bộ sưu tập", route: "products" }
    ]
  },
  {
    title: "Hỗ trợ",
    links: [
      { label: "Hướng dẫn size", route: "home" },
      { label: "Đổi trả", route: "home" },
      { label: "Vận chuyển", route: "home" },
      { label: "Liên hệ", route: "home" }
    ]
  },
  {
    title: "Tài khoản",
    links: [
      { label: "Đăng nhập", route: "login" },
      { label: "Đơn hàng", route: "orders" },
      { label: "Yêu thích", route: "wishlist" },
      { label: "Địa chỉ", route: "profile", section: "address" }
    ]
  }
];

const paymentMethods = SUPPORTED_CHECKOUT_PAYMENT_METHODS.map((method) => method.footerLabel);

export function createCustomerFooter() {
  return `
    <div class="customer-container footer-grid">
      <section class="footer-brand">
        <a class="store-logo" href="#home" aria-label="Trang chủ N&amp;L Store">
          <span class="store-logo-mark"><img src="../assets/images/nl-store-logo.png?v=20260729-logo" alt=""></span>
          <span>
            <strong>N&amp;L Store</strong>
            <small>Phong cách hiện đại</small>
          </span>
        </a>
        <p>Thời trang hiện đại cho công việc, cuộc sống và những ngày cần một diện mạo thật gọn gàng.</p>
        <ul class="footer-contact-list">
          <li><i class="fa-solid fa-location-dot" aria-hidden="true"></i> 128 Đường 3/2, Phường Ninh Kiều, TP. Cần Thơ</li>
          <li><i class="fa-solid fa-phone" aria-hidden="true"></i> <a href="tel:+84793244405">+84 793244405</a></li>
          <li><i class="fa-solid fa-envelope" aria-hidden="true"></i> <a href="mailto:contactwork.ad@gmail.com">contactwork.ad@gmail.com</a></li>
        </ul>
        <div class="footer-socials" aria-label="Mạng xã hội">
          <a href="#facebook" aria-label="Facebook"><i class="fa-brands fa-facebook-f" aria-hidden="true"></i></a>
          <a href="#instagram" aria-label="Instagram"><i class="fa-brands fa-instagram" aria-hidden="true"></i></a>
          <a href="#tiktok" aria-label="TikTok"><i class="fa-brands fa-tiktok" aria-hidden="true"></i></a>
        </div>
      </section>
      ${footerColumns.map(createFooterColumn).join("")}
      <section class="footer-column footer-payment">
        <h2>Thanh toán</h2>
        <p>Chúng tôi hỗ trợ các phương thức thanh toán an toàn và linh hoạt.</p>
        <div class="footer-payment-list">
          ${paymentMethods.map((method) => `<span>${method}</span>`).join("")}
        </div>
      </section>
    </div>
    <div class="customer-container footer-bottom">
      <span>© 2026 N&amp;L Store. Bảo lưu mọi quyền.</span>
      <span>V1.0.0</span>
    </div>
  `;
}

function createFooterColumn(column) {
  return `
    <section class="footer-column">
      <h2>${column.title}</h2>
      ${column.links.map((link) => `<a href="#${link.route}" data-footer-link="${link.route}" data-footer-section="${link.section || ""}">${link.label}</a>`).join("")}
    </section>
  `;
}
