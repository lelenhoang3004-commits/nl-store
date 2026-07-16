import { createProductGrid, initProductGrid } from "../product-grid/product-grid.js";

export function createFlashSaleSection(options = {}) {
  const {
    title = "Ưu đãi chớp nhoáng",
    subtitle = "Phiên bản giới hạn với giá trị cao cho tủ đồ tinh tế hơn.",
    items = [],
    loading = false,
    empty = false,
    page = 1,
    totalPages = 1,
    onPageChange = null
  } = options;

  return `
    <section class="flash-sale-section" data-flash-sale-section>
      <div class="section-heading flash-sale-heading">
        <div>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        <a class="customer-button secondary" href="#products">Xem tất cả</a>
      </div>
      <div class="flash-sale-banner">
        <div>
          <span class="hero-kicker">Phiên bản giới hạn</span>
          <h3>Tiết kiệm cho các món thiết yếu được chọn lọc trước đợt hàng tiếp theo.</h3>
        </div>
        <div class="flash-sale-timer" data-flash-sale-timer aria-label="Đồng hồ đếm ngược ưu đãi chớp nhoáng">
          <div><strong data-countdown-day>00</strong><span>Ngày</span></div>
          <div><strong data-countdown-hour>00</strong><span>Giờ</span></div>
          <div><strong data-countdown-minute>00</strong><span>Phút</span></div>
          <div><strong data-countdown-second>00</strong><span>Giây</span></div>
        </div>
      </div>
      ${createProductGrid({ items, loading, empty, page, totalPages, onPageChange })}
    </section>
  `;
}

export function initFlashSaleSection(root = document) {
  initProductGrid(root);
  initCountdownTimer(root);
}

function initCountdownTimer(root) {
  const timer = root.querySelector("[data-flash-sale-timer]");
  if (!timer) {
    return;
  }

  const deadline = new Date(Date.now() + 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 60 * 7 + 1000 * 60 * 42);

  const dayEl = timer.querySelector("[data-countdown-day]");
  const hourEl = timer.querySelector("[data-countdown-hour]");
  const minuteEl = timer.querySelector("[data-countdown-minute]");
  const secondEl = timer.querySelector("[data-countdown-second]");

  const tick = () => {
    const now = new Date();
    const diff = deadline - now;

    if (diff <= 0) {
      if (dayEl) dayEl.textContent = "00";
      if (hourEl) hourEl.textContent = "00";
      if (minuteEl) minuteEl.textContent = "00";
      if (secondEl) secondEl.textContent = "00";
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    if (dayEl) dayEl.textContent = String(days).padStart(2, "0");
    if (hourEl) hourEl.textContent = String(hours).padStart(2, "0");
    if (minuteEl) minuteEl.textContent = String(minutes).padStart(2, "0");
    if (secondEl) secondEl.textContent = String(seconds).padStart(2, "0");
  };

  tick();
  window.setInterval(tick, 1000);
}
