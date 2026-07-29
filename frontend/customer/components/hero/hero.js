const DEFAULT_HERO_SLIDES = [
  {
    id: 1,
    title: "S&#7855;c &#273;&#7887; n&#259;ng &#273;&#7897;ng cho nh&#7883;p s&#7889;ng hi&#7879;n &#273;&#7841;i",
    description: "Phom d&#225;ng th&#7875; thao, &#273;&#432;&#7901;ng c&#7855;t g&#7885;n v&#224; tinh th&#7847;n ph&#7889; th&#7883; s&#7855;c n&#233;t.",
    ctaPrimary: "Mua ngay",
    ctaSecondary: "Kh&#225;m ph&#225; b&#7897; s&#432;u t&#7853;p",
    badge: "New season",
    promo: "Mi&#7877;n ph&#237; giao h&#224;ng cho &#273;&#417;n t&#7915; 500K",
    image: "./assets/images/hero/hero-slide-1.png",
    objectPosition: "68% 48%",
    mobileObjectPosition: "66% 44%"
  },
  {
    id: 2,
    title: "B&#7843;n ph&#7889;i monochrome &#7845;m &#225;p v&#224; t&#7921; tin",
    description: "Ch&#7845;t li&#7879;u m&#7873;m, gam m&#224;u n&#7893;i b&#7853;t v&#224; t&#7927; l&#7879; g&#7885;n g&#224;ng cho m&#7885;i chuy&#7875;n &#273;&#7897;ng.",
    ctaPrimary: "Xem b&#7897; s&#432;u t&#7853;p",
    ctaSecondary: "Xem &#432;u &#273;&#227;i",
    badge: "Limited edit",
    promo: "Th&#224;nh vi&#234;n nh&#7853;n quy&#7873;n truy c&#7853;p s&#7899;m",
    image: "./assets/images/hero/hero-slide-2.png",
    objectPosition: "66% 47%",
    mobileObjectPosition: "64% 43%"
  },
  {
    id: 3,
    title: "Thanh l&#7883;ch ven bi&#7875;n trong t&#7915;ng chuy&#7875;n &#273;&#7897;ng",
    description: "H&#7885;a ti&#7871;t hoa xanh, phom &#273;&#7847;m bay nh&#7865; v&#224; c&#7843;m gi&#225;c sang tr&#7885;ng cho ng&#224;y n&#7855;ng.",
    ctaPrimary: "Kh&#225;m ph&#225; ngay",
    ctaSecondary: "S&#7843;n ph&#7849;m m&#7899;i",
    badge: "Resort mood",
    promo: "Ti&#7871;t ki&#7879;m &#273;&#7871;n 30% cho s&#7843;n ph&#7849;m ch&#7885;n l&#7885;c",
    image: "./assets/images/hero/hero-slide-3.png",
    objectPosition: "69% 50%",
    mobileObjectPosition: "67% 45%"
  }
];

function createHeroImageStyle(slide = {}) {
  return [
    slide.objectPosition ? `--hero-object-position: ${slide.objectPosition}` : "",
    slide.mobileObjectPosition ? `--hero-mobile-object-position: ${slide.mobileObjectPosition}` : ""
  ].filter(Boolean).join("; ");
}

export function createHeroComponent(options = {}) {
  const slides = Array.isArray(options.slides) && options.slides.length
    ? options.slides
    : DEFAULT_HERO_SLIDES;

  const heroId = options.id || "customer-hero-slider";

  return `
    <section class="hero-component" id="${heroId}" data-hero-component>
      <div class="hero-track" data-hero-track>
        ${slides.map((slide, index) => `
          <article class="hero-slide hero-slide-${index + 1} ${index === 0 ? "is-active" : ""}" data-hero-slide data-slide-id="${slide.id}">
            <img src="${slide.image}" alt="${slide.title}" loading="${index === 0 ? "eager" : "lazy"}" decoding="async" style="${createHeroImageStyle(slide)}">
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

      <div class="hero-controls customer-container" aria-label="Dieu khien trinh chieu">
        <button class="hero-nav hero-nav-prev" type="button" data-hero-prev aria-label="Slide truoc">
          <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
        </button>
        <div class="hero-indicators" data-hero-indicators>
          ${slides.map((_, index) => `<button class="hero-indicator ${index === 0 ? "is-active" : ""}" type="button" data-hero-indicator="${index}" aria-label="Di toi slide ${index + 1}"></button>`).join("")}
        </div>
        <button class="hero-nav hero-nav-next" type="button" data-hero-next aria-label="Slide tiep theo">
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

  if (!component || !slides.length || component.dataset.heroInitialized === "true") {
    return;
  }

  component.dataset.heroInitialized = "true";
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
    intervalId = null;
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
