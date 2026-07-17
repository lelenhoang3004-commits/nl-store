const defaultProduct = {
  id: "product-1",
  name: "Áo khoác cấu trúc tối giản",
  category: "Áo khoác",
  image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
  imageAlt: "Sản phẩm thời trang cao cấp",
  hoverImage: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
  price: 1290000,
  comparePrice: 1590000,
  discount: 19,
  rating: 4.8,
  sold: 184,
  badge: "MỚI",
  inStock: true,
  isWishlist: false,
  isCompare: false
};

export function normalizeProductCardData(product = {}) {
  return {
    ...defaultProduct,
    ...product,
    image: globalThis.normalizeImageUrl?.(product.image) ?? product.image ?? defaultProduct.image,
    hoverImage: product.hoverImage ? (globalThis.normalizeImageUrl?.(product.hoverImage) ?? product.hoverImage) : "",
    price: product.price ?? defaultProduct.price,
    comparePrice: product.comparePrice ?? defaultProduct.comparePrice,
    discount: product.discount ?? defaultProduct.discount,
    rating: product.rating ?? defaultProduct.rating,
    sold: product.sold ?? defaultProduct.sold,
    badge: product.badge ?? defaultProduct.badge,
    inStock: product.inStock ?? defaultProduct.inStock,
    stock: Number(product.stock ?? (product.inStock === false ? 0 : 1)),
    salePrice: product.salePrice ?? product.sale_price ?? null,
    finalPrice: product.finalPrice ?? product.final_price ?? product.price ?? defaultProduct.price,
    thumbnailUrl: globalThis.normalizeImageUrl?.(product.thumbnailUrl || product.thumbnail_url || product.image) ?? (product.thumbnailUrl || product.thumbnail_url || product.image || defaultProduct.image),
    imageUrl: globalThis.normalizeImageUrl?.(product.imageUrl || product.image_url || product.image) ?? (product.imageUrl || product.image_url || product.image || defaultProduct.image),
    selectedImageUrl: globalThis.normalizeImageUrl?.(product.selectedImageUrl || product.selected_image_url || product.image) ?? (product.selectedImageUrl || product.selected_image_url || product.image || defaultProduct.image),
    variantCount: Number(product.variantCount ?? product.variant_count ?? (Array.isArray(product.variants) ? product.variants.length : 0)),
    hasVariants: Boolean(product.hasVariants ?? product.has_variants ?? Number(product.variantCount ?? product.variant_count ?? (Array.isArray(product.variants) ? product.variants.length : 0)) > 0),
    isWishlist: Boolean(product.isWishlist),
    isCompare: Boolean(product.isCompare)
  };
}

export function createProductCard(product) {
  const item = normalizeProductCardData(product);
  const priceText = formatCurrency(item.price);
  const comparePriceText = item.comparePrice ? formatCurrency(item.comparePrice) : "";
  const badgeClass = `product-badge ${getBadgeClass(item.badge)}`;
  const stockLabel = item.inStock ? "Còn hàng" : "Hết hàng";

  return `
    <article class="product-card ds-hover" data-product-card="${item.id}">
      <div class="product-card-media-wrap">
        <a class="product-media" href="#product-detail/${item.id}" aria-label="${item.name}">
          <span class="${badgeClass}">${item.badge}</span>
          <img class="product-media-image primary-image" src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${item.image}" alt="${item.imageAlt || item.name}" loading="lazy" decoding="async">
          ${item.hoverImage ? `<img class="product-media-image secondary-image" src="${globalThis.FASHION_IMAGE_PLACEHOLDER}" data-product-image-src="${item.hoverImage}" alt="${item.imageAlt || item.name} alternate" loading="lazy" decoding="async">` : ""}
        </a>
        <div class="product-card-actions" aria-label="Hành động sản phẩm">
          <button class="icon-pill product-action-btn ${item.isWishlist ? "is-active" : ""}" type="button" aria-label="Thêm vào yêu thích" data-wishlist-toggle="${item.id}">
            <i class="${item.isWishlist ? "fa-solid" : "fa-regular"} fa-heart" aria-hidden="true"></i>
          </button>
          <a class="icon-pill product-action-btn" href="#product-detail/${item.id}" aria-label="Xem sản phẩm">
            <i class="fa-regular fa-eye" aria-hidden="true"></i>
          </a>
        </div>
        ${item.discount ? `<span class="product-discount">-${item.discount}%</span>` : ""}
      </div>

      <div class="product-card-content">
        <div class="product-card-meta">
          <span class="ds-tag">${item.category}</span>
          <span class="product-stock ${item.inStock ? "in-stock" : "out-of-stock"}">${stockLabel}</span>
        </div>
        <h3><a href="#product-detail/${item.id}">${item.name}</a></h3>
        <div class="product-rating" aria-label="Đánh giá ${item.rating} trên 5">
          <span>${renderStars(item.rating)}</span>
          <small>${item.rating.toFixed(1)}</small>
        </div>
        <div class="product-price-row">
          <div class="product-price-group">
            <strong>${priceText}</strong>
            ${comparePriceText ? `<del>${comparePriceText}</del>` : ""}
          </div>
          <span class="product-sold">${item.sold} đã bán</span>
        </div>
        <div class="product-card-button-row">
          <button class="ds-button product-card-button" type="button" data-add-to-cart data-product-id="${item.id}">
            <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>
            Thêm giỏ
          </button>
          <button class="ds-button product-card-button product-card-buy-now" type="button"
            data-buy-now
            data-product-id="${item.id}"
            data-product-name="${escapeHtml(item.name)}"
            data-product-price="${Number(item.price || 0)}"
            data-product-sale-price="${item.salePrice !== null && item.salePrice !== undefined ? Number(item.salePrice) : ""}"
            data-product-final-price="${Number(item.finalPrice || item.price || 0)}"
            data-product-thumbnail-url="${escapeHtml(item.thumbnailUrl || item.image || "")}"
            data-product-image-url="${escapeHtml(item.imageUrl || item.image || "")}"
            data-product-selected-image-url="${escapeHtml(item.selectedImageUrl || item.image || "")}"
            data-product-variant-count="${Number(item.variantCount || 0)}"
            data-product-has-variants="${item.hasVariants ? "true" : "false"}"
            data-product-stock="${Number(item.stock || 0)}">
            <i class="fa-solid fa-bolt" aria-hidden="true"></i>
            Mua ngay
          </button>
        </div>
      </div>
    </article>
  `;
}

export function createProductCardSkeleton(count = 4) {
  return Array.from({ length: count }, (_, index) => `
    <article class="product-card product-card-skeleton" aria-hidden="true">
      <div class="product-card-media-wrap">
        <div class="skeleton-media product-skeleton-media"></div>
      </div>
      <div class="product-card-content">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line short"></div>
      </div>
    </article>
  `).join("");
}

export function initProductCard(root = document) {
  root.querySelectorAll("[data-product-card]").forEach((card) => {
    card.addEventListener("mouseenter", () => card.classList.add("is-hovered"));
    card.addEventListener("mouseleave", () => card.classList.remove("is-hovered"));
  });
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

function renderStars(rating) {
  const full = Math.round(rating);
  return "&#9733;".repeat(full) + "&#9734;".repeat(5 - full);
}

function getBadgeClass(badge) {
  switch (badge?.toUpperCase()) {
    case "HOT":
    case "BÁN CHẠY":
      return "is-hot";
    case "SALE":
    case "GIẢM GIÁ":
      return "is-sale";
    case "OUT OF STOCK":
    case "HẾT HÀNG":
      return "is-soldout";
    default:
      return "is-new";
  }
}
