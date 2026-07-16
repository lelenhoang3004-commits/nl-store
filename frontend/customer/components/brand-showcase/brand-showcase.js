export function createBrandShowcaseSection(options = {}) {
  const {
    title = "Thương hiệu nổi bật",
    description = "Những nhãn hàng đáng tin cậy tạo nên phong cách đặc trưng.",
    brands = []
  } = options;

  const items = brands.length ? brands : getDefaultBrands();

  return `
    <section class="brand-showcase-section" data-brand-showcase-section data-reveal>
      <div class="section-heading brand-showcase-heading">
        <div>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>
      </div>
      <div class="brand-showcase-slider" data-brand-showcase-slider>
        <div class="brand-showcase-track" data-brand-showcase-track>
          ${items.map(createBrandCard).join("")}
          ${items.map(createBrandCard).join("")}
        </div>
      </div>
    </section>
  `;
}

export function initBrandShowcaseSection(root = document) {
  const slider = root.querySelector("[data-brand-showcase-slider]");
  const track = root.querySelector("[data-brand-showcase-track]");

  if (!slider || !track) {
    return;
  }

  let offset = 0;
  const speed = 0.45;
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

function createBrandCard(brand) {
  const name = brand.name || "Thương hiệu";
  const logo = brand.logo || name;
  const href = brand.href || "#products";

  return `
    <a class="brand-showcase-item" href="${href}">
      <span>${logo}</span>
      <strong>${name}</strong>
    </a>
  `;
}

function getDefaultBrands() {
  return [
    { name: "AURELIA" },
    { name: "ATLAS" },
    { name: "NOVA" },
    { name: "LINO" },
    { name: "MERCER" },
    { name: "ORION" }
  ];
}
