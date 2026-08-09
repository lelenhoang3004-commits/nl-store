import { setButtonLoading } from "../loading/loading.js";
import { notifyError, notifyInfo, notifySuccess, notifyWarning } from "../../../assets/js/notify.js";
import { bindValidation, validateForm } from "../validation/validation.js";

let activeModal = null;
let modalCloseTimer = null;

export function openModal(options = {}) {
  window.clearTimeout(modalCloseTimer);
  closeModal();

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.dataset.modalOverlay = "";
  modal.innerHTML = createModalTemplate(options);

  document.body.appendChild(modal);
  document.body.classList.add("modal-open");
  activeModal = { element: modal, options };

  bindModalEvents(modal, options);
  bindValidation(modal.querySelector("[data-validate-form]"));

  requestAnimationFrame(() => {
    modal.classList.add("is-visible");
    modal.querySelector("[data-modal-close]")?.focus();
  });

  return {
    close: closeModal
  };
}

export function closeModal() {
  if (!activeModal) {
    return;
  }

  const modal = activeModal.element;
  modal.classList.remove("is-visible");
  document.removeEventListener("keydown", handleEscapeKey);

  modalCloseTimer = window.setTimeout(() => {
    modal.remove();

    if (activeModal?.element === modal) {
      document.body.classList.remove("modal-open");
      activeModal = null;
    }
  }, 180);
}

export function openCrudModal(type, row = {}, moduleName = "Module") {
  const modalConfig = getCrudModalConfig(type, row, moduleName);
  return openModal(modalConfig);
}

function bindModalEvents(modal, options) {
  modal.querySelectorAll("[data-modal-close]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  modal.querySelector("[data-modal-save]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const form = modal.querySelector("[data-validate-form]");

    if (button.disabled) return;

    if (form) {
      const validation = validateForm(form);

      if (!validation.isValid) {
        notifyError("Vui lòng kiểm tra lại thông tin.");
        return;
      }
    }

    setButtonLoading(button, true);

    try {
      await wait(options.loadingDelay ?? 220);
      await options.onSave?.(modal);
      if (options.successMessage) {
        notifySuccess(options.successMessage);
      }
      closeModal();
    } catch (error) {
      const target = modal.querySelector("[data-modal-error], [data-category-form-error], [data-form-error]");
      if (target) target.textContent = error?.message || "Không thể xử lý yêu cầu.";
      if (options.showErrorToast !== false) {
        notifyError(error?.message || "Không thể xử lý yêu cầu.");
      }
    } finally {
      if (document.body.contains(button)) {
        setButtonLoading(button, false);
      }
    }
  });

  modal.addEventListener("click", (event) => {
    if (event.target.matches("[data-modal-overlay]")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", handleEscapeKey);
}

function handleEscapeKey(event) {
  if (event.key === "Escape") {
    closeModal();
    document.removeEventListener("keydown", handleEscapeKey);
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function createModalTemplate(options) {
  const variantClass = options.variant ? ` modal-${options.variant}` : "";
  const saveText = escapeHtml(options.saveText ?? "Lưu");
  const cancelText = escapeHtml(options.cancelText ?? "Hủy");
  const showSave = options.showSave !== false;
  const eyebrow = escapeHtml(options.eyebrow ?? "Admin");
  const title = escapeHtml(options.title ?? "Chi tiết");
  const closeLabel = escapeHtml(options.closeLabel ?? "Đóng modal");

  return `
    <section class="modal-dialog${variantClass}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal-header">
        <div>
          <p class="modal-eyebrow">${eyebrow}</p>
          <h2 id="modal-title">${title}</h2>
        </div>
        <button class="modal-icon-button" type="button" aria-label="${closeLabel}" data-modal-close>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </header>

      <div class="modal-body">
        ${options.body ?? ""}
      </div>

      <footer class="modal-footer">
        <button class="modal-secondary-button" type="button" data-modal-close>${cancelText}</button>
        ${showSave ? `
          <button class="modal-primary-button" type="button" data-modal-save>
            ${saveText}
          </button>
        ` : ""}
      </footer>
    </section>
  `;
}

function getCrudModalConfig(type, row, moduleName) {
  const safeRow = sanitizeRow(row ?? {});
  const safeModuleName = escapeHtml(moduleName);
  const emptyText = "Chưa có dữ liệu";
  const detailBody = `
    <div class="modal-detail-grid">
      <span>Tên</span><strong>${safeRow.name ?? emptyText}</strong>
      <span>Nhóm</span><strong>${safeRow.category ?? emptyText}</strong>
      <span>Trạng thái</span><strong>${safeRow.status ?? emptyText}</strong>
      <span>Giá trị</span><strong>${safeRow.total ?? emptyText}</strong>
    </div>
  `;

  const formBody = `
    <div class="modal-form-grid" data-validate-form>
      <div class="validation-summary" data-validation-summary></div>
      <label class="validation-field">
        <span>Tên hiển thị</span>
        <input type="text" name="name" value="${safeRow.name ?? ""}" placeholder="Nhập tên" data-label="Tên hiển thị" data-validate="required|min:2|max:80">
      </label>
      <label class="validation-field">
        <span>Nhóm</span>
        <input type="text" name="category" value="${safeRow.category ?? ""}" placeholder="Nhập nhóm" data-label="Nhóm" data-validate="required|min:2|max:60">
      </label>
      <label class="validation-field">
        <span>Trạng thái</span>
        <select name="status" data-label="Trạng thái" data-validate="required">
          <option>Đang bán</option>
          <option>Chờ duyệt</option>
          <option>Tạm ẩn</option>
        </select>
      </label>
      <label class="validation-field">
        <span>Giá trị</span>
        <input type="text" name="total" value="${safeRow.total ?? ""}" placeholder="Nhập giá trị" data-label="Giá trị" data-validate="required|price">
      </label>
    </div>
  `;

  const deleteBody = `
    <p class="modal-danger-copy">
      Bạn đang chuẩn bị xóa <strong>${safeRow.name ?? moduleName}</strong>. Đây chỉ là giao diện mẫu,
      chưa có thao tác Backend thật.
  `;

  const configs = {
    create: {
      eyebrow: safeModuleName,
      title: `Thêm ${moduleName}`,
      body: formBody,
      saveText: "L?u"
    },
    edit: {
      eyebrow: safeModuleName,
      title: `Sửa ${safeRow.name ?? moduleName}`,
      body: formBody,
      saveText: "L?u"
    },
    view: {
      eyebrow: safeModuleName,
      title: `Chi tiết ${safeRow.name ?? moduleName}`,
      body: detailBody,
      showSave: false,
      cancelText: "??ng"
    },
    delete: {
      eyebrow: safeModuleName,
      title: "Xác nhận xóa",
      body: deleteBody,
      saveText: "X?a",
      variant: "danger",
      successMessage: "Đã xác nhận xóa trên giao diện mẫu."
    }
  };

  return configs[type] ?? configs.view;
}

function sanitizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value == null ? value : escapeHtml(value)
    ])
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

