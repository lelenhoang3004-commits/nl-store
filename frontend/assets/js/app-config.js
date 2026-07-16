window.FASHION_API_BASE_URL = "https://nl-store.onrender.com/api/v1";
window.FASHION_API_ORIGIN = "https://nl-store.onrender.com";

window.FASHION_IMAGE_PLACEHOLDER = "https://placehold.co/900x1125/f1f5f9/334155?text=Fashion+Store";

window.normalizeImageUrl = function normalizeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return window.FASHION_IMAGE_PLACEHOLDER;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;

  const apiOrigin = String(window.FASHION_API_ORIGIN || "https://nl-store.onrender.com").replace(/\/$/, "");
  if (url.startsWith("/uploads")) return `${apiOrigin}${url}`;
  if (url.startsWith("uploads")) return `${apiOrigin}/${url}`;

  return url;
};