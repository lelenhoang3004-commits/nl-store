window.FASHION_API_BASE_URL = "https://nl-store.onrender.com/api/v1";
window.FASHION_API_ORIGIN = "https://nl-store.onrender.com";

window.FASHION_IMAGE_PLACEHOLDER = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='750' viewBox='0 0 600 750'%3E%3Crect width='600' height='750' fill='%23f1f5f9'/%3E%3Cpath d='M210 330h180v140H210z' fill='%23e2e8f0'/%3E%3Ccircle cx='270' cy='385' r='28' fill='%23cbd5e1'/%3E%3Cpath d='m230 450 55-55 38 38 28-28 45 45z' fill='%2394a3b8'/%3E%3C/svg%3E";

window.normalizeImageUrl = function normalizeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return window.FASHION_IMAGE_PLACEHOLDER;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;

  const apiOrigin = String(window.FASHION_API_ORIGIN || "https://nl-store.onrender.com").replace(/\/$/, "");
  if (url.startsWith("/uploads")) return `${apiOrigin}${url}`;
  if (url.startsWith("uploads")) return `${apiOrigin}/${url}`;

  return url;
};
window.initializeProductImages = function initializeProductImages(root = document) {
  const images = root.querySelectorAll?.("img[data-product-image-src]") || [];
  const loadImage = (image) => {
    const source = image.dataset.productImageSrc;
    if (!source) return;
    image.src = window.normalizeImageUrl(source);
    image.removeAttribute("data-product-image-src");
  };

  images.forEach((image) => {
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.removeAttribute("data-product-image-src");
      image.src = window.FASHION_IMAGE_PLACEHOLDER;
    }, { once: true });

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
  image.removeAttribute("data-product-image-src");
  image.removeAttribute("data-gallery-image-src");
  image.src = window.FASHION_IMAGE_PLACEHOLDER;
}, true);

window.addEventListener("DOMContentLoaded", () => {
  window.initializeProductImages(document);
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches?.("img[data-product-image-src]")) window.initializeProductImages(node.parentElement || node);
      else if (node.querySelector?.("img[data-product-image-src]")) window.initializeProductImages(node);
    }));
  });
  observer.observe(document.body, { childList: true, subtree: true });
});