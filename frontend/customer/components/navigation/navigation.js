const navigationItems = [
  { label: "Trang chủ", href: "#home" },
  { label: "Hàng mới", href: "#new-arrival" },
  { label: "Bán chạy", href: "#best-seller" },
  { label: "Thương hiệu", href: "#brands" }
];

const megaMenuColumns = [
  {
    title: "Nam",
    links: [
      { label: "Áo khoác", keyword: "ao-khoac" },
      { label: "Áo len", keyword: "ao-len" },
      { label: "Quần tối giản", keyword: "quan-toi-gian" },
      { label: "Phụ kiện cá nhân", keyword: "phu-kien" }
    ]
  },
  {
    title: "Nữ",
    links: [
      { label: "Áo blazer", keyword: "ao-blazer" },
      { label: "Đầm midi", keyword: "dam-midi" },
      { label: "Chân váy", keyword: "chan-vay" },
      { label: "Quần jeans", keyword: "quan-jeans" }
    ]
  },
  {
    title: "Phụ kiện",
    links: [
      { label: "Túi xách", keyword: "tui-xach" },
      { label: "Đồng hồ", keyword: "dong-ho" },
      { label: "Trang sức", keyword: "trang-suc" },
      { label: "Kính mắt", keyword: "kinh-mat" },
      { label: "Mũ nón", keyword: "mu-non" }
    ]
  }
];

const promoHighlights = [
  { label: "Khuyến mãi", text: "Giảm đến 30% cho bộ sưu tập mới.", href: "#promotion" },
  { label: "Bộ sưu tập", text: "Lớp phối tối giản cho phong cách hiện đại.", href: "#collections" },
  { label: "Thương hiệu", text: "Cùng các đối tác thời trang hàng đầu.", href: "#brands" }
];

export function createCustomerNavigation() {
  return `
    <nav class="customer-nav" aria-label="Điều hướng chính" data-customer-nav>
      ${navigationItems.map((item) => `<a href="${item.href}">${item.label}</a>`).join("")}
      <div class="nav-mega-wrapper">
        <button type="button" aria-expanded="false" data-mega-toggle>
          Danh mục <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
        </button>
        <div class="mega-menu" data-mega-menu>
          <div class="mega-menu-columns">
            ${megaMenuColumns.map(createMegaMenuColumn).join("")}
          </div>
          <aside class="mega-menu-sidebar">
            <div class="mega-menu-highlight">
              <span>Khuyến mãi nổi bật</span>
              <strong>Thời trang cao cấp cho mọi khoảnh khắc.</strong>
              <a href="#promotion">Khám phá ngay</a>
            </div>
            <div class="mega-menu-stack">
              ${promoHighlights.map((item) => `<a href="${item.href}"><strong>${item.label}</strong><span>${item.text}</span></a>`).join("")}
            </div>
          </aside>
        </div>
      </div>
    </nav>
  `;
}

export function initCustomerNavigation(root = document) {
  const nav = root.querySelector("[data-customer-nav]");
  const megaToggle = root.querySelector("[data-mega-toggle]");
  const megaMenu = root.querySelector("[data-mega-menu]");
  const currentHref = (window.location.hash || "#home").toLowerCase();
  nav?.querySelectorAll("a").forEach((link) => {
    link.classList.toggle("is-active", link.getAttribute("href")?.toLowerCase() === currentHref);
  });

  megaToggle?.addEventListener("click", () => {
    const isOpen = megaMenu?.classList.toggle("is-open") ?? false;
    megaToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav?.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (link) {
      megaMenu?.classList.remove("is-open");
      megaToggle?.setAttribute("aria-expanded", "false");
      nav.querySelectorAll("a").forEach((item) => item.classList.toggle("is-active", item === link));
    }
  });

  document.addEventListener("click", (event) => {
    if (!nav?.contains(event.target) && !megaToggle?.contains(event.target)) {
      megaMenu?.classList.remove("is-open");
      megaToggle?.setAttribute("aria-expanded", "false");
    }
  });
}

function createMegaMenuColumn(column) {
  return `
    <section class="mega-menu-group">
      <h2>${column.title}</h2>
      ${column.links.map((link) => {
        const item = typeof link === "string" ? { label: link, keyword: "" } : link;
        const href = item.href || `#products?keyword=${encodeURIComponent(item.keyword)}`;
        return `<a href="${href}" data-mega-category="${item.keyword || ""}">${item.label}</a>`;
      }).join("")}
    </section>
  `;
}
