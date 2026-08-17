window.FASHION_API_BASE_URL = "https://nl-store.onrender.com/api/v1";
window.FASHION_API_ORIGIN = "https://nl-store.onrender.com";

window.FASHION_IMAGE_PLACEHOLDER = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='750' viewBox='0 0 600 750'%3E%3Crect width='600' height='750' fill='%23f1f5f9'/%3E%3Cpath d='M210 330h180v140H210z' fill='%23e2e8f0'/%3E%3Ccircle cx='270' cy='385' r='28' fill='%23cbd5e1'/%3E%3Cpath d='m230 450 55-55 38 38 28-28 45 45z' fill='%2394a3b8'/%3E%3C/svg%3E";

window.normalizeImageUrl = function normalizeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return window.FASHION_IMAGE_PLACEHOLDER;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/uploads") || url.startsWith("uploads")) return window.FASHION_IMAGE_PLACEHOLDER;

  return url;
};

window.getImageDerivativeUrl = function getImageDerivativeUrl(value, type = "thumbnail") {
  const original = window.normalizeImageUrl(value);
  if (!original || original === window.FASHION_IMAGE_PLACEHOLDER) return original;
  if (original.startsWith("data:") || original.startsWith("blob:")) return original;
  const suffix = type === "medium" ? "medium" : "thumb";

  try {
    const url = new URL(original, window.location.href);
    if (!url.pathname.includes("/products/")) return original;
    const nextPath = url.pathname.replace(/\.(png|jpe?g|webp)$/i, `-${suffix}.webp`);
    if (nextPath === url.pathname) return original;
    url.pathname = nextPath;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return original;
  }
};
window.initializeProductImages = function initializeProductImages(root = document) {
  const images = root.querySelectorAll?.("img[data-product-image-src], img[data-gallery-image-src]") || [];
  const loadImage = (image) => {
    const source = image.dataset.productImageSrc || image.dataset.galleryImageSrc;
    if (!source) return;
    const original = window.normalizeImageUrl(source);
    const derivative = image.dataset.productImageDerivative;
    const preferred = derivative ? window.getImageDerivativeUrl(original, derivative) : original;
    if (preferred !== original) image.dataset.productImageFallbackSrc = original;
    image.src = preferred;
    image.removeAttribute("data-product-image-src");
    image.removeAttribute("data-gallery-image-src");
  };

  images.forEach((image) => {
    image.loading = image.getAttribute("loading") || "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      if (image.dataset.productImageFallbackApplied === "true") {
        image.removeAttribute("data-product-image-fallback-applied");
        return;
      }
      const fallback = image.dataset.productImageFallbackSrc;
      if (fallback && image.src !== fallback) {
        image.dataset.productImageFallbackApplied = "true";
        image.removeAttribute("data-product-image-fallback-src");
        image.src = fallback;
        return;
      }
      image.removeAttribute("data-product-image-src");
      image.removeAttribute("data-gallery-image-src");
      image.src = window.FASHION_IMAGE_PLACEHOLDER;
    });

    if (!("IntersectionObserver" in window)) {
      loadImage(image);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        loadImage(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "200px 0px" });
    observer.observe(image);
  });
};

window.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.matches("[data-product-image]")) return;
  if (image.src === window.FASHION_IMAGE_PLACEHOLDER) return;
  const fallback = image.dataset.productImageFallbackSrc;
  if (fallback && image.src !== fallback) {
    image.dataset.productImageFallbackApplied = "true";
    image.removeAttribute("data-product-image-fallback-src");
    image.src = fallback;
    return;
  }
  image.removeAttribute("data-product-image-src");
  image.removeAttribute("data-gallery-image-src");
  image.src = window.FASHION_IMAGE_PLACEHOLDER;
}, true);

window.addEventListener("DOMContentLoaded", () => {
  window.initializeProductImages(document);
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches?.("img[data-product-image-src], img[data-gallery-image-src]")) window.initializeProductImages(node.parentElement || node);
      else if (node.querySelector?.("img[data-product-image-src], img[data-gallery-image-src]")) window.initializeProductImages(node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
});
