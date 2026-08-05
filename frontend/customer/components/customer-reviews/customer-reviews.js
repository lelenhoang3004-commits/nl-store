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
      <div class="customer-reviews-slider" data-customer-reviews-slider>
        <div class="customer-reviews-track" data-customer-reviews-track>
          ${items.map(createReviewCard).join("")}
          ${items.map(createReviewCard).join("")}
        </div>
      </div>
    </section>
  `;
}

export function initCustomerReviewsSection(root = document) {
  const slider = root.querySelector("[data-customer-reviews-slider]");
  const track = root.querySelector("[data-customer-reviews-track]");

  if (!slider || !track) {
    return;
  }

  let offset = 0;
  const speed = 0.35;
  let animationFrame = null;

  const step = () => {
    offset -= speed;
    const maxOffset = track.scrollWidth / 2;

    if (Math.abs(offset) >= maxOffset) {
      offset = 0;
    }

    track.style.transform = `translateX(${offset}px)`;
    animationFrame = window.requestAnimationFrame(step);
  };

  const start = () => {
    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(step);
    }
  };

  const stop = () => {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  };

  slider.addEventListener("mouseenter", stop);
  slider.addEventListener("mouseleave", start);
  start();
}

function createReviewCard(review) {
  const name = review.name || "Khách hàng";
  const role = review.role || "Người mua đã xác thực";
  const content = review.content || "Trải nghiệm mượt mà từ lần nhấp đầu tiên đến khi hoàn tất thanh toán.";
  const rating = review.rating || 5;
  const avatar = review.avatar || getInitials(name);

  return `
    <article class="customer-review-card">
      <div class="customer-review-top">
        <div class="customer-review-avatar">${avatar}</div>
        <div>
          <h3>${name}</h3>
          <p>${role}</p>
        </div>
      </div>
      <div class="customer-review-stars" aria-label="Đánh giá ${rating} trên 5">${"★".repeat(rating)}${"☆".repeat(5 - rating)}</div>
      <p class="customer-review-content">"${content}"</p>
    </article>
  `;
}

function getInitials(name) {
  return name
    .split(" ")
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
