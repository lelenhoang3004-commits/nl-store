import { createProductGrid, initProductGrid } from "../components/product-grid/product-grid.js";
import { createHeroComponent, initHeroComponent } from "../components/hero/hero.js";
import { createFlashSaleSection, initFlashSaleSection } from "../components/flash-sale/flash-sale.js";
import { createFeaturedProductsSection, initFeaturedProductsSection } from "../components/featured-products/featured-products.js";
import { createNewArrivalSection, initNewArrivalSection } from "../components/new-arrival/new-arrival.js";
import { createBestSellerSection, initBestSellerSection } from "../components/best-seller/best-seller.js";
import { createCategoryShowcaseSection } from "../components/category-showcase/category-showcase.js";
import { createBrandShowcaseSection, initBrandShowcaseSection } from "../components/brand-showcase/brand-showcase.js";
import { createCustomerReviewsSection, initCustomerReviewsSection } from "../components/customer-reviews/customer-reviews.js";

const API_BASE_URL = globalThis.FASHION_API_BASE_URL ?? (
  ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname)
    ? "http://localhost:5000/api/v1"
    : "https://nl-store.onrender.com/api/v1"
);
const API_ORIGIN = globalThis.FASHION_API_ORIGIN ?? API_BASE_URL.replace(/\/api\/v1\/?$/, "");

const contentShape = {
  hero: {
    eyebrow: "Bộ sưu tập 2026",
    title: "Thời trang hiện đại cho phong cách mỗi ngày.",
    description: "Trải nghiệm mua sắm thời trang cao cấp, tinh tế và dễ sử dụng.",
    primaryCta: "Mua sắm ngay",
    secondaryCta: "Khám phá thêm"
  },
  flashSale: {
    eyebrow: "Khuyến mãi giới hạn",
    title: "Khuyến mãi giới hạn",
    subtitle: "Những lựa chọn nổi bật với mức giá tốt trong thời gian có hạn."
  },
  categories: [
    { title: "Nam", subtitle: "Những món đồ may đo cơ bản", icon: "fa-shirt" },
    { title: "Nữ", subtitle: "Phom dáng mềm mại", icon: "fa-person-dress" },
    { title: "Phụ kiện", subtitle: "Phong cách sang trọng nhẹ nhàng", icon: "fa-glasses" },
    { title: "Bộ sưu tập", subtitle: "Lớp phối tối giản", icon: "fa-layer-group" }
  ],
  reviews: [
    { quote: "Trải nghiệm mượt mà, tinh tế và phù hợp với phong cách sống hiện đại.", author: "Mina, London" },
    { quote: "Nhanh chóng, tinh tế và bố cục đẹp mắt từ đầu đến cuối.", author: "Noah, Sydney" },
    { quote: "Mỗi phần đều được chăm chút kỹ lưỡng và rất đáng tin cậy.", author: "Alicia, Toronto" }
  ]
};

const productCatalog = [
  { id: "s1", name: "Áo khoác linen nhẹ", category: "Áo khoác", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80", price: 1290000, comparePrice: 1590000, discount: 19, rating: 4.8, sold: 184, badge: "MỚI", inStock: true },
  { id: "s2", name: "Áo len dáng ôm", category: "Lớp phối", image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80", price: 890000, comparePrice: 1190000, discount: 25, rating: 4.7, sold: 142, badge: "HOT", inStock: true },
  { id: "s3", name: "Áo khoác trench mềm", category: "Cơ bản", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80", price: 1090000, comparePrice: 1390000, discount: 21, rating: 4.9, sold: 267, badge: "GIẢM GIÁ", inStock: true },
  { id: "s4", name: "Túi tote tối giản", category: "Phụ kiện", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", price: 760000, comparePrice: 920000, discount: 17, rating: 4.6, sold: 92, badge: "MỚI", inStock: true },
  { id: "s5", name: "Áo khoác tiện dụng đô thị", category: "Áo khoác", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80", price: 1490000, comparePrice: 1790000, discount: 16, rating: 4.8, sold: 221, badge: "HOT", inStock: true },
  { id: "s6", name: "Túi xách sang trọng", category: "Phụ kiện", image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=80", price: 1160000, comparePrice: 1380000, discount: 15, rating: 4.7, sold: 111, badge: "GIẢM GIÁ", inStock: true },
  { id: "s7", name: "Áo sơ mi hiện đại", category: "Nam", image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80", price: 940000, comparePrice: 1120000, discount: 16, rating: 4.5, sold: 88, badge: "MỚI", inStock: false },
  { id: "s8", name: "Bộ knit studio", category: "Bộ sưu tập", image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80", hoverImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80", price: 1360000, comparePrice: 1640000, discount: 17, rating: 4.9, sold: 154, badge: "MỚI", inStock: true }
];


const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80";

function getListFromApiPayload(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  return [];
}

function resolveAssetUrl(value) {
  if (!value) return FALLBACK_PRODUCT_IMAGE;
  return globalThis.normalizeImageUrl?.(value) ?? value;
}

function getPreferredProductImage(product = {}) {
  const galleryUrls = Array.isArray(product.galleryUrls)
    ? product.galleryUrls
    : Array.isArray(product.gallery_urls)
      ? product.gallery_urls
      : [];
  const candidates = [product.thumbnailUrl, product.thumbnail_url, product.imageUrl, product.image_url, ...galleryUrls]
    .filter(Boolean)
    .map(resolveAssetUrl);
  const uniqueCandidates = [...new Set(candidates)].sort((left, right) => Number(isAbsoluteHttpUrl(right)) - Number(isAbsoluteHttpUrl(left)));
  return uniqueCandidates[0] || FALLBACK_PRODUCT_IMAGE;
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function mapApiProduct(product = {}) {
  const price = Number(product.price || 0);
  const salePrice = product.salePrice ? Number(product.salePrice) : null;
  const finalPrice = salePrice || price;

  return {
    id: product.id,
    name: product.name,
    category: product.categoryName || "Sản phẩm",
    image: getPreferredProductImage(product),
    hoverImage: "",
    thumbnailUrl: getPreferredProductImage(product),
    imageUrl: getPreferredProductImage(product),
    selectedImageUrl: getPreferredProductImage(product),
    price: finalPrice,
    salePrice,
    finalPrice,
    comparePrice: salePrice ? price : null,
    discount: salePrice && price > salePrice
      ? Math.round(((price - salePrice) / price) * 100)
      : 0,
    rating: Number(product.ratingAverage ?? product.rating_average ?? product.rating ?? 4.8),
    sold: Number(product.sold || 0),
    badge: salePrice ? "GIẢM GIÁ" : "MỚI",
    inStock: Number(product.stock || 0) > 0,
    stock: Number(product.stock || 0),
    variantCount: Number(product.variantCount ?? product.variant_count ?? (Array.isArray(product.variants) ? product.variants.length : 0)),
    hasVariants: Number(product.variantCount ?? product.variant_count ?? (Array.isArray(product.variants) ? product.variants.length : 0)) > 0,
    variants: Array.isArray(product.variants) ? product.variants : []
  };
}

async function loadProductsFromApi() {
  try {
    const response = await fetch(`${API_BASE_URL}/products`);
    const payload = await response.json();

    const products = getListFromApiPayload(payload, "products").map(mapApiProduct);

    return products.length ? products : productCatalog;
  } catch (error) {
    console.error("Không tải được sản phẩm từ API:", error);
    return productCatalog;
  }
}

async function loadHomepageData() {
  const [products, categories] = await Promise.all([
    loadProductsFromApi(),
    loadCategoriesFromApi()
  ]);

  return {
    products,
    categories
  };
}

async function loadCategoriesFromApi() {
  try {
    const response = await fetch(`${API_BASE_URL}/categories`);
    const payload = await response.json();

    const categories = getListFromApiPayload(payload, "categories").map(normalizeHomeCategory);

    return categories;
  } catch (error) {
    console.error("Không tải được danh mục từ API:", error);
    return [];
  }
}

function normalizeHomeCategory(category = {}) {
  const name = category.name || "Danh mục";
  const slug = category.slug || category.code || slugifyCategoryName(name);
  const productCount = Number(category.productCount ?? category.product_count ?? category.productsCount ?? category.totalProducts ?? category.total_products ?? 0);
  const image = category.imageUrl || category.image_url || category.thumbnailUrl || category.thumbnail_url || category.coverImage || category.cover_image || getCategoryImageByName(name);

  return {
    id: category.id,
    name,
    slug,
    productCount,
    image,
    icon: category.icon || getCategoryIconByName(name),
    href: `#products?keyword=${encodeURIComponent(slug)}`
  };
}

function getFeaturedHomeCategories(categories = []) {
  const source = categories.length ? categories : getFallbackHomeCategories();
  const withProducts = source.filter((category) => Number(category.productCount || 0) > 0);
  return (withProducts.length ? withProducts : source).slice(0, 8);
}

function getFallbackHomeCategories() {
  return [
    normalizeHomeCategory({ name: "Áo khoác", slug: "ao-khoac", productCount: 24 }),
    normalizeHomeCategory({ name: "Chân váy", slug: "chan-vay", productCount: 18 }),
    normalizeHomeCategory({ name: "Giày", slug: "giay", productCount: 15 }),
    normalizeHomeCategory({ name: "Mũ nón", slug: "mu-non", productCount: 12 }),
    normalizeHomeCategory({ name: "Dây chuyền", slug: "trang-suc", productCount: 10 }),
    normalizeHomeCategory({ name: "Mắt kính", slug: "kinh-mat", productCount: 8 }),
    normalizeHomeCategory({ name: "Đồng hồ", slug: "dong-ho", productCount: 7 }),
    normalizeHomeCategory({ name: "Túi xách", slug: "tui-xach", productCount: 9 })
  ];
}

function slugifyCategoryName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "products";
}

function getCategoryImageByName(name = "") {
  const key = slugifyCategoryName(name);
  const images = {
    "ao-khoac": "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80",
    "ao-len": "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80",
    "chan-vay": "https://images.unsplash.com/photo-1583496661160-fb5886a13d27?auto=format&fit=crop&w=600&q=80",
    "giay": "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80",
    "mu-non": "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=600&q=80",
    "tui-xach": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
    "dong-ho": "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=600&q=80",
    "trang-suc": "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80",
    "kinh-mat": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=600&q=80"
  };
  return images[key] || "";
}

function getCategoryIconByName(name = "") {
  const key = slugifyCategoryName(name);
  if (key.includes("giay")) return "fa-shoe-prints";
  if (key.includes("mu")) return "fa-hat-cowboy";
  if (key.includes("day") || key.includes("trang-suc")) return "fa-gem";
  if (key.includes("kinh")) return "fa-glasses";
  if (key.includes("dong-ho")) return "fa-clock";
  if (key.includes("tui")) return "fa-bag-shopping";
  if (key.includes("vay") || key.includes("dam")) return "fa-person-dress";
  return "fa-shirt";
}

export function createHomePage() {
  return `
    <div class="customer-container customer-page-shell" data-home-content>
      ${createSkeletonShell()}
    </div>
  `;
}

let homePageDataCache = null;
let homePageLoadPromise = null;

async function loadHomePage(target) {
  if (!target || target.dataset.loaded === "true" || target.dataset.loaded === "loading") {
    return;
  }

  target.dataset.loaded = "loading";

  try {
    const data = homePageDataCache || await getHomePageData();
    homePageDataCache = data;
    renderHomeContent(target, data.products, data.categories);
  } catch (error) {
    console.error("Lỗi tải trang chủ:", error);
    target.dataset.loaded = "error";
    target.innerHTML = createHomeErrorState();
  }
}

function getHomePageData() {
  if (!homePageLoadPromise) {
    homePageLoadPromise = loadHomepageData().finally(() => {
      homePageLoadPromise = null;
    });
  }

  return homePageLoadPromise;
}

function renderHomeContent(target, products, categories) {
  window.__homepageProducts = products;
  target.innerHTML = createPremiumHomepageMarkup(products, categories);
  target.dataset.loaded = "true";

  setupRevealAnimation(target);
  initHeroComponent(target);
  initProductGrid(target);
  initFlashSaleSection(target);
  initFeaturedProductsSection(target);
  initNewArrivalSection(target);
  initBestSellerSection(target);
  initBrandShowcaseSection(target);
  initCustomerReviewsSection(target);
}

function createHomeErrorState() {
  return `
    <section class="customer-empty-state" data-reveal>
      <h2>Không thể tải trang chủ</h2>
      <p>Đã xảy ra lỗi khi tải sản phẩm. Vui lòng thử lại sau.</p>
      <a class="customer-button" href="#home">Thử lại</a>
    </section>
  `;
}

export function initHomePage(root = document) {
  const target = root.querySelector("[data-home-content]");

  if (!target) {
    return;
  }

  return loadHomePage(target);
}
function createPremiumHomepageMarkup(products = productCatalog, categories = []) {
  const jewelryProducts = products.filter(isJewelryProduct);
  return `
    ${createHeroComponent()}

    <section id="flash-sale" class="premium-section" data-reveal>
      ${createFlashSaleSection({
    title: contentShape.flashSale.eyebrow,
    subtitle: contentShape.flashSale.subtitle,
    items: products.slice(0, 4),
    page: 1,
    totalPages: 1
  })}
    </section>

    <section id="featured-product" class="premium-section" data-reveal>
      ${createFeaturedProductsSection({
    title: "Sản phẩm nổi bật",
    description: "Lựa chọn đặc sắc để nâng tầm tủ đồ với phong thái tự tin và tinh tế.",
    actionText: "Xem chi tiết",
    actionHref: "#story",
    items: products.slice(0, 8),
    page: 1,
    totalPages: 1
  })}
    </section>

    <section id="new-arrival" class="premium-section" data-reveal>
      ${createNewArrivalSection({
    title: "Hàng mới",
    description: "Những thiết kế mới tươi tắn cho phong cách chuyển động hiện đại và trang phục hàng ngày nâng tầm.",
    actionText: "Khám phá",
    actionHref: "#products",
    items: products.slice(0, 4),
    page: 1,
    totalPages: 1
  })}
    </section>

    <section id="best-seller" class="premium-section" data-reveal>
      ${createBestSellerSection({
    title: "Bán chạy",
    description: "Các bộ sưu tập cân bằng giữa sự thoải mái, phom dáng và tính linh hoạt.",
    actionText: "Mua hàng bán chạy",
    actionHref: "#products",
    items: products.slice(0, 4),
    page: 1,
    totalPages: 2,
    onPageChange: "handleProductGridPage"
  })}
    </section>

    <section id="categories" class="premium-section" data-reveal>
      ${createCategoryShowcaseSection({
    title: "Danh mục",
    description: "Duyệt theo phong cách, chức năng và mùa một cách thuận tiện.",
    actionText: "Xem tất cả",
    actionHref: "#products",
    categories: getFeaturedHomeCategories(categories)
  })}
    </section>

    <section id="jewelry" class="premium-section" data-reveal>
      <div class="section-heading">
        <div>
          <h2>Trang sức</h2>
          <p>Khám phá các mẫu dây chuyền được lấy trực tiếp từ danh mục sản phẩm.</p>
        </div>
      </div>
      ${createProductGrid({
        items: jewelryProducts,
        empty: jewelryProducts.length === 0,
        page: 1,
        totalPages: Math.max(1, Math.ceil(jewelryProducts.length / 8))
      })}
    </section>

    <section id="brands" class="premium-section" data-reveal>
      ${createBrandShowcaseSection({
    title: "Thương hiệu",
    description: "Những nhãn hàng uy tín và dấu ấn riêng tạo nên phong cách.",
    brands: [
      { name: "AURELIA" },
      { name: "ATLAS" },
      { name: "NOVA" },
      { name: "LINO" },
      { name: "MERCER" },
      { name: "ORION" }
    ]
  })}
    </section>

    <section id="reviews" class="premium-section" data-reveal>
      ${createCustomerReviewsSection({
    title: "Đánh giá",
    description: "Trải nghiệm được thiết kế để cảm giác trực quan, tinh tế và đáng tin cậy.",
    reviews: [
      { name: "Mina Lee", role: "Biên tập phong cách", content: "Trải nghiệm thật sự được chăm chút như chính những sản phẩm mình đang mua.", rating: 5 },
      { name: "Noah Kim", role: "Khách hàng thường xuyên", content: "Mọi thứ dễ duyệt và cảm giác sang trọng vẫn được giữ nguyên từ đầu đến cuối.", rating: 5 },
      { name: "Alicia Tran", role: "Giám đốc sáng tạo", content: "Một cửa hàng được thiết kế vừa thư thái vừa giúp chọn lựa sản phẩm trở nên dễ dàng.", rating: 5 },
      { name: "Jules Carter", role: "Người mua cao cấp", content: "Cách kể chuyện về sản phẩm và bố cục đều đẹp, trực quan và dễ hiểu.", rating: 5 }
    ]
  })}
    </section>

  `;
}

function isJewelryProduct(product = {}) {
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const searchable = `${normalize(product.name)} ${normalize(product.category)} ${normalize(product.categoryName)}`;
  return searchable.includes("day chuyen") || searchable.includes("trang suc");
}

function createSkeletonShell() {
  return `
    <section class="premium-hero skeleton-shell" data-reveal>
      <div class="skeleton-block skeleton-title"></div>
      <div class="skeleton-block skeleton-copy"></div>
      <div class="skeleton-block skeleton-copy short"></div>
      <div class="skeleton-row">
        <div class="skeleton-pill"></div>
        <div class="skeleton-pill"></div>
      </div>
    </section>
    <section class="premium-section skeleton-section" data-reveal>
      <div class="skeleton-block skeleton-title"></div>
      <div class="product-grid">
        ${createSkeletonCards(4)}
      </div>
    </section>
  `;
}

function createSkeletonCards(count) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-media"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line short"></div>
    </div>
  `).join("");
}

window.handleProductGridPage = function handleProductGridPage(page) {
  const target = document.querySelector("[data-home-content]");
  if (!target) {
    return;
  }

  const current = target.querySelector("[data-product-grid-shell]");
  if (!current) {
    return;
  }

  const products = window.__homepageProducts || productCatalog;
  current.outerHTML = createProductGrid({
    items: products,
    page,
    totalPages: Math.ceil(products.length / 8),
    onPageChange: "handleProductGridPage"
  });
  initProductGrid(target);
};

function setupRevealAnimation(root) {
  const revealItems = root.querySelectorAll("[data-reveal]");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries, currentObserver) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        currentObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
}
