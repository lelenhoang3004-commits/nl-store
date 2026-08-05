import { initCarousel } from "../carousel/carousel.js";

export function createCustomerReviewsSection(options = {}) {
  const {
    title = "Câu chuyện khách hàng",
    description = "Những chia sẻ của cộng đồng về trải nghiệm, độ vừa vặn và cảm nhận.",
    reviews = []
  } = options;

  const items = reviews.length ? reviews : getDefaultReviews();

  return `
    <section class="customer-reviews-section" data-customer-reviews-section data-reveal>
      <div class="section-heading customer-reviews-heading">
        <div>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>
      </div>
      <div class="customer-reviews-carousel carousel" data-customer-reviews-carousel>
        <div class="carousel-track">
          ${items.map(createReviewSlide).join("")}
        </div>
      </div>
    </section>
  `;
}

export function initCustomerReviewsSection(root = document) {
  const section = root.querySelector("[data-customer-reviews-section]");
  if (!section) return;

  initCarousel(section, {
    perPage: 3,
    gap: 20,
    loop: false,
    autoplay: false,
    indicators: true,
    navigation: true,
    draggable: true,
    breakpoints: {
      640: 1,
      900: 2,
      1200: 3
    }
  });

  bindReviewExpansion(section);
}

function createReviewSlide(review) {
  const name = review.name || "Khách hàng";
  const role = review.role || "Khách hàng";
  const content = review.content || "Trải nghiệm mượt mà từ lần nhấp đầu tiên đến khi hoàn tất thanh toán.";
  const rating = Number(review.rating ?? 5);
  const avatar = review.avatar || getInitials(name);

  return `
    <div class="carousel-slide">
      <article class="customer-review-card">
        <div class="customer-review-top">
          <div class="customer-review-avatar">${avatar}</div>
          <div class="customer-review-meta">
            <h3>${name}</h3>
            <p>${role}</p>
          </div>
        </div>
        <div class="customer-review-stars" aria-label="Đánh giá ${rating} trên 5">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
        <div class="customer-review-body">
          <span class="customer-review-quote-icon" aria-hidden="true">“</span>
          <p class="customer-review-content" data-review-content>${content}</p>
          <button type="button" class="customer-review-expand" data-review-expand hidden>Xem thêm</button>
        </div>
      </article>
    </div>
  `;
}

function bindReviewExpansion(section) {
  const cards = Array.from(section.querySelectorAll('.customer-review-card'));
  cards.forEach((card) => {
    const content = card.querySelector('[data-review-content]');
    const button = card.querySelector('[data-review-expand]');
    if (!content || !button) return;

    const update = () => {
      const lineHeight = parseFloat(window.getComputedStyle(content).lineHeight) || 1.6;
      const maxHeight = Math.round(lineHeight * 4);
      content.style.maxHeight = '';
      content.style.overflow = '';
      const needsCollapse = content.scrollHeight > maxHeight + 4;

      if (needsCollapse) {
        content.dataset.collapsed = 'true';
        content.style.maxHeight = `${maxHeight}px`;
        content.style.overflow = 'hidden';
        button.hidden = false;
        button.textContent = 'Xem thêm';
      } else {
        button.hidden = true;
        content.style.maxHeight = 'none';
        content.style.overflow = 'visible';
      }
    };

    update();
    window.addEventListener('resize', update);

    button.addEventListener('click', () => {
      const collapsed = content.dataset.collapsed === 'true';
      if (collapsed) {
        content.dataset.collapsed = 'false';
        content.style.maxHeight = 'none';
        content.style.overflow = 'visible';
        button.textContent = 'Thu gọn';
      } else {
        const lineHeight = parseFloat(window.getComputedStyle(content).lineHeight) || 1.6;
        const maxHeight = Math.round(lineHeight * 4);
        content.dataset.collapsed = 'true';
        content.style.maxHeight = `${maxHeight}px`;
        content.style.overflow = 'hidden';
        button.textContent = 'Xem thêm';
      }
    });
  });
}

function getInitials(name) {
  return String(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getDefaultReviews() {
  return [
    { name: "Mina Lee", role: "Chuyên gia phong cách", content: "Trải nghiệm mượt mà và tinh tế, nhờ đó sản phẩm càng thêm giá trị.", rating: 5 },
    { name: "Noah Kim", role: "Khách hàng thường xuyên", content: "Mọi thứ dễ dàng tìm kiếm và cảm giác sang trọng từ đầu đến cuối.", rating: 5 },
    { name: "Alicia Tran", role: "Giám đốc sáng tạo", content: "Giao diện cửa hàng tạo cảm giác nhẹ nhàng và chọn lựa sản phẩm thật dễ dàng.", rating: 5 },
    { name: "Jules Carter", role: "Người mua cao cấp", content: "Câu chuyện sản phẩm và bố cục thật đẹp, trực quan và cuốn hút.", rating: 5 }
  ];
}
