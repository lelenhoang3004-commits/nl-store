import { initCarousel } from "../carousel/carousel.js";

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
      <div class="brand-showcase-carousel carousel" data-brand-showcase-carousel>
        <div class="carousel-track">
          ${items.map(createBrandSlide).join("")}
        </div>
      </div>
    </section>
  `;
}

export function initBrandShowcaseSection(root = document) {
  const section = root.querySelector("[data-brand-showcase-section]");
  if (!section) return;
  initCarousel(section, {
    perPage: 5,
    gap: 18,
    loop: false,
    autoplay: false,
    indicators: true,
    navigation: true,
    draggable: true,
    breakpoints: {
      640: 2,
      900: 4,
      1200: 5,
      1600: 6
    }
  });
}

function createBrandSlide(brand) {
  const name = brand.name || "Thương hiệu";
  const initials = getBrandInitials(name);
  const href = brand.href || buildBrandHref(brand);

  return `
    <div class="carousel-slide">
      <a class="brand-showcase-item" href="${href}">
        <span class="brand-showcase-abbr">${initials}</span>
        <strong>${name}</strong>
      </a>
    </div>
  `;
}

function buildBrandHref(brand) {
  if (brand.href) return brand.href;
  if (brand.brandId) return `#products?brandId=${encodeURIComponent(brand.brandId)}`;
  if (brand.brandCode) return `#products?brandCode=${encodeURIComponent(brand.brandCode)}`;
  if (brand.code) return `#products?brandCode=${encodeURIComponent(brand.code)}`;
  if (brand.slug) return `#products?brand=${encodeURIComponent(brand.slug)}`;
  return `#products?brand=${encodeURIComponent(brand.name || "")}`;
}

function getBrandInitials(name = "") {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
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
