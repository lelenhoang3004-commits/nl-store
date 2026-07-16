let activeConfirm = null;
let confirmCloseTimer = null;

export function confirmDialog(options = {}) {
  window.clearTimeout(confirmCloseTimer);
  closeConfirm(false);

  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className = "confirm-overlay";
    dialog.dataset.confirmOverlay = "";
    dialog.innerHTML = createConfirmTemplate(options);

    document.body.appendChild(dialog);
    document.body.classList.add("confirm-open");
    activeConfirm = { element: dialog, resolve };

    bindConfirmEvents(dialog, options);

    requestAnimationFrame(() => {
      dialog.classList.add("is-visible");
      dialog.querySelector("[data-confirm-cancel]")?.focus();
    });
  });
}

export function closeConfirm(result = false) {
  if (!activeConfirm) {
    return;
  }

  const { element, resolve } = activeConfirm;
  element.classList.remove("is-visible");
  document.removeEventListener("keydown", handleConfirmKeydown);

  confirmCloseTimer = window.setTimeout(() => {
    element.remove();
    const isCurrentConfirm = activeConfirm?.element === element;

    if (isCurrentConfirm) {
      document.body.classList.remove("confirm-open");
      activeConfirm = null;
    }

    resolve(result);
  }, 170);
}

export const confirmPresets = {
  delete(itemName = "mục này") {
    return confirmDialog({
      type: "danger",
      icon: "fa-trash-can",
      title: "Xác nhận xóa",
      message: `Bạn có chắc chắn muốn xóa ${itemName}? Thao tác này chỉ là mô phỏng giao diện.`,
      confirmText: "Xóa",
      cancelText: "Hủy"
    });
  },
  lockAccount(itemName = "tài khoản này") {
    return confirmDialog({
      type: "warning",
      icon: "fa-user-lock",
      title: "Khóa tài khoản",
      message: `Bạn có chắc chắn muốn khóa ${itemName}?`,
      confirmText: "Khóa",
      cancelText: "Hủy"
    });
  },
  cancelOrder(itemName = "đơn hàng này") {
    return confirmDialog({
      type: "warning",
      icon: "fa-ban",
      title: "Hủy đơn hàng",
      message: `Bạn có chắc chắn muốn hủy ${itemName}?`,
      confirmText: "Hủy đơn",
      cancelText: "Quay lại"
    });
  },
  logout() {
    return confirmDialog({
      type: "info",
      icon: "fa-arrow-right-from-bracket",
      title: "Đăng xuất",
      message: "Bạn có chắc chắn muốn đăng xuất khỏi Admin Panel?",
      confirmText: "Đăng xuất",
      cancelText: "Ở lại"
    });
  }
};

function bindConfirmEvents(dialog) {
  dialog.querySelector("[data-confirm-cancel]")?.addEventListener("click", () => {
    closeConfirm(false);
  });

  dialog.querySelector("[data-confirm-ok]")?.addEventListener("click", () => {
    closeConfirm(true);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target.matches("[data-confirm-overlay]")) {
      closeConfirm(false);
    }
  });

  document.addEventListener("keydown", handleConfirmKeydown);
}

function handleConfirmKeydown(event) {
  if (event.key === "Escape") {
    closeConfirm(false);
  }
}

function createConfirmTemplate(options) {
  const type = toSafeClassToken(options.type ?? "danger", "danger");
  const icon = toSafeClassToken(options.icon ?? "fa-triangle-exclamation", "fa-triangle-exclamation");
  const title = options.title ?? "Xác nhận thao tác";
  const message = options.message ?? "Bạn có chắc chắn muốn tiếp tục?";
  const confirmText = escapeHtml(options.confirmText ?? "Confirm");
  const cancelText = escapeHtml(options.cancelText ?? "Cancel");
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return `
    <section class="confirm-dialog confirm-${type}" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="confirm-icon" aria-hidden="true">
        <i class="fa-solid ${icon}"></i>
      </div>
      <div class="confirm-content">
        <h2 id="confirm-title">${safeTitle}</h2>
        <p>${safeMessage}</p>
      </div>
      <footer class="confirm-actions">
        <button class="confirm-cancel" type="button" data-confirm-cancel>${cancelText}</button>
        <button class="confirm-ok" type="button" data-confirm-ok>${confirmText}</button>
      </footer>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toSafeClassToken(value, fallback) {
  const token = String(value);
  return /^[a-z0-9_-]+$/i.test(token) ? token : fallback;
}
