let pageLoadingToken = 0;
let pageLoadingHideTimer = null;
const activePageLoadingTokens = new Set();

export function showPageLoading(message = "Đang tải nội dung...") {
  pageLoadingToken += 1;
  const token = pageLoadingToken;
  activePageLoadingTokens.add(token);
  window.clearTimeout(pageLoadingHideTimer);

  let overlay = document.querySelector("[data-page-loading]");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "page-loading-overlay";
    overlay.dataset.pageLoading = "";
    overlay.innerHTML = `
      <div class="page-loading-card">
        ${createSpinner("lg")}
        <strong>${message}</strong>
        <span>Vui lòng chờ trong giây lát.</span>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  overlay.dataset.loadingToken = String(token);
  const messageElement = overlay.querySelector("strong");

  if (messageElement) {
    messageElement.textContent = message;
  }

  requestAnimationFrame(() => {
    overlay.classList.add("is-visible");
  });

  return token;
}

export function hidePageLoading(token = pageLoadingToken) {
  const overlay = document.querySelector("[data-page-loading]");
  activePageLoadingTokens.delete(token);

  if (!overlay || activePageLoadingTokens.size > 0) {
    return;
  }

  overlay.classList.remove("is-visible");

  pageLoadingHideTimer = window.setTimeout(() => {
    if (activePageLoadingTokens.size === 0) {
      overlay.remove();
    }
  }, 180);
}

export function setButtonLoading(button, isLoading, loadingText = "Đang xử lý") {
  if (!button) {
    return;
  }

  if (isLoading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = `
      ${createSpinner("sm")}
      <span>${loadingText}</span>
    `;
    return;
  }

  button.disabled = false;
  button.classList.remove("is-loading");
  button.innerHTML = button.dataset.originalHtml ?? button.innerHTML;
  delete button.dataset.originalHtml;
}

export function createSpinner(size = "md") {
  return `<span class="loading-spinner loading-spinner-${size}" aria-hidden="true"></span>`;
}

export function createSkeletonRows({ rows = 5, columns = 6, actionColumn = true } = {}) {
  const totalColumns = actionColumn ? columns + 1 : columns;

  return `
    <div class="loading-skeleton-table" aria-label="Đang tải dữ liệu">
      ${Array.from({ length: rows }).map(() => `
        <div class="loading-skeleton-row" style="grid-template-columns: repeat(${totalColumns}, minmax(72px, 1fr));">
          ${Array.from({ length: totalColumns }).map(() => `<span></span>`).join("")}
        </div>
      `).join("")}
    </div>
  `;
}
