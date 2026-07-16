export function createHeroComponent(options = {}) {
  const slides = Array.isArray(options.slides) && options.slides.length
    ? options.slides
    : [
        {
          id: 1,
          title: "Những thiết kế tinh giản cho tủ đồ hiện đại",
          description: "Lựa chọn lớp phối, phom dáng sạch và các mẫu cao cấp cho mọi nhịp sống.",
          ctaPrimary: "Mua ngay",
          ctaSecondary: "Khám phá bộ sưu tập",
          badge: "Mùa mới",
          promo: "Miễn phí giao hàng nhanh cho đơn hàng trên 500K",
          image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1600&q=80"
        },
        {
          id: 2,
          title: "Thiết kế linh hoạt cho sự tự tin thanh lịch",
          description: "Khám phá áo khoác tinh tế và len tối giản phù hợp cuộc sống hiện đại.",
          ctaPrimary: "Xem bộ sưu tập",
          ctaSecondary: "Xem câu chuyện",
          badge: "Phiên bản giới hạn",
          promo: "Thành viên mở khóa truy cập sớm và ưu đãi riêng",
          image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1600&q=80"
        },
        {
          id: 3,
          title: "Bộ sưu tập hoàn hảo của những món đồ cao cấp",
          description: "Phom dáng tối giản, chất liệu mềm mại và cảm giác thời trang thoải mái.",
          ctaPrimary: "Xem ngay",
          ctaSecondary: "Xem ưu đãi",
          badge: "Ưu đãi chớp nhoáng",
          promo: "Tiết kiệm đến 30% cho sản phẩm chọn lọc trong tuần",
          image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1600&q=80"
        }
      ];

  const heroId = options.id || "customer-hero-slider";

  return `
    <section class="hero-component" id="${heroId}" data-hero-component>
      <div class="hero-track" data-hero-track>
        ${slides.map((slide, index) => `
          <article class="hero-slide ${index === 0 ? "is-active" : ""}" data-hero-slide data-slide-id="${slide.id}">
            <img src="${slide.image}" alt="${slide.title}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async">
            <div class="hero-overlay"></div>
            <div class="hero-content customer-container">
              <div class="hero-copy">
                <span class="hero-kicker">${slide.badge}</span>
                <h1>${slide.title}</h1>
                <p>${slide.description}</p>
                <div class="hero-actions">
                  <a class="ds-button" href="#featured-product">${slide.ctaPrimary}</a>
                  <a class="ds-button secondary" href="#collections">${slide.ctaSecondary}</a>
                </div>
                <div class="hero-promo">
                  <i class="fa-solid fa-bolt" aria-hidden="true"></i>
                  <span>${slide.promo}</span>
                </div>
              </div>
            </div>
          </article>
        `).join("")}
      </div>

      <div class="hero-controls customer-container" aria-label="Điều khiển trình chiếu">
        <button class="hero-nav hero-nav-prev" type="button" data-hero-prev aria-label="Slide trước">
          <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
        </button>
        <div class="hero-indicators" data-hero-indicators>
          ${slides.map((_, index) => `<button class="hero-indicator ${index === 0 ? "is-active" : ""}" type="button" data-hero-indicator="${index}" aria-label="Đi tới slide ${index + 1}"></button>`).join("")}
        </div>
        <button class="hero-nav hero-nav-next" type="button" data-hero-next aria-label="Slide tiếp theo">
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </section>
  `;
}

export function initHeroComponent(root = document) {
  const component = root.querySelector("[data-hero-component]");
  const slides = root.querySelectorAll("[data-hero-slide]");
  const indicators = root.querySelectorAll("[data-hero-indicator]");
  const prevButton = root.querySelector("[data-hero-prev]");
  const nextButton = root.querySelector("[data-hero-next]");

  if (!component || !slides.length) {
    return;
  }

  let activeIndex = 0;
  let intervalId = null;

  function render(index) {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === activeIndex));
    indicators.forEach((indicator, indicatorIndex) => indicator.classList.toggle("is-active", indicatorIndex === activeIndex));
  }

  function startAutoPlay() {
    clearInterval(intervalId);
    intervalId = window.setInterval(() => render(activeIndex + 1), 5000);
  }

  function stopAutoPlay() {
    clearInterval(intervalId);
  }

  prevButton?.addEventListener("click", () => {
    render(activeIndex - 1);
    startAutoPlay();
  });

  nextButton?.addEventListener("click", () => {
    render(activeIndex + 1);
    startAutoPlay();
  });

  indicators.forEach((indicator) => {
    indicator.addEventListener("click", () => {
      render(Number(indicator.dataset.heroIndicator));
      startAutoPlay();
    });
  });

  let touchStartX = 0;
  let touchEndX = 0;

  component.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
  }, { passive: true });

  component.addEventListener("touchend", (event) => {
    touchEndX = event.changedTouches[0].clientX;
    const delta = touchEndX - touchStartX;
    if (delta > 50) {
      render(activeIndex - 1);
    } else if (delta < -50) {
      render(activeIndex + 1);
    }
    startAutoPlay();
  }, { passive: true });

  component.addEventListener("mouseenter", stopAutoPlay);
  component.addEventListener("mouseleave", startAutoPlay);

  render(0);
  startAutoPlay();
}
