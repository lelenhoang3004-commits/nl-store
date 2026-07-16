const footerColumns = [
  {
    title: "Danh mục",
    links: ["Sản phẩm mới", "Bán chạy", "Ưu đãi", "Bộ sưu tập"]
  },
  {
    title: "Hỗ trợ",
    links: ["Hướng dẫn size", "Đổi trả", "Vận chuyển", "Liên hệ"]
  },
  {
    title: "Tài khoản",
    links: ["Đăng nhập", "Đơn hàng", "Yêu thích", "Địa chỉ"]
  }
];

const paymentMethods = ["Visa", "Mastercard", "PayPal", "Momo"];

export function createCustomerFooter() {
  return `
    <div class="customer-container footer-newsletter">
      <div>
        <span class="hero-kicker">Bản tin</span>
        <h2>Cập nhật những bộ sưu tập theo mùa mới nhất.</h2>
        <p>Nhận thông tin ra mắt, cập nhật phong cách và quyền truy cập độc quyền.</p>
      </div>
      <form data-newsletter-form novalidate>
        <label>
          <span class="sr-only">Email</span>
          <input name="email" type="email" placeholder="Email của bạn" required>
        </label>
        <input type="hidden" name="fullName" value="">
        <button class="customer-button" type="submit">Đăng ký</button>
        <p class="newsletter-feedback" data-newsletter-feedback aria-live="polite"></p>
      </form>
    </div>
    <div class="customer-container footer-grid">
      <section class="footer-brand">
        <a class="store-logo" href="#home" aria-label="Trang chủ N&amp;L Store">
          <span class="store-logo-mark"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i></span>
          <span>
            <strong>N&amp;L Store</strong>
            <small>Phong cách hiện đại</small>
          </span>
        </a>
        <p>Thời trang hiện đại cho công việc, cuộc sống và những ngày cần một diện mạo thật gọn gàng.</p>
        <ul class="footer-contact-list">
          <li><i class="fa-solid fa-location-dot" aria-hidden="true"></i> 128 Nguyễn Huệ, Quận 1, TP. HCM</li>
          <li><i class="fa-solid fa-phone" aria-hidden="true"></i> +84 28 1234 5678</li>
          <li><i class="fa-solid fa-envelope" aria-hidden="true"></i> hello@fashionstore.com</li>
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
      <span>Phiên bản giao diện khách hàng 1.0.0</span>
    </div>
  `;
}

function createFooterColumn(column) {
  return `
    <section class="footer-column">
      <h2>${column.title}</h2>
      ${column.links.map((link) => `<a href="#${link.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, "").replaceAll(" ", "-")}">${link}</a>`).join("")}
    </section>
  `;
}
