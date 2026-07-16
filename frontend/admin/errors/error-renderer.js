import { openModal } from "../components/modal/modal.js";
import { toast } from "../components/toast/toast.js";
import { ERROR_DISPLAY, ERROR_TYPES } from "./error-types.js";

// Renders normalized errors through existing Toast and Modal components.
class ErrorRenderer {
  show(error) {
    if (error.display === ERROR_DISPLAY.silent) {
      return null;
    }

    if (error.display === ERROR_DISPLAY.modal) {
      return this.showModal(error);
    }

    return this.showToast(error);
  }

  showToast(error) {
    const type = error.type === ERROR_TYPES.validation ? "warning" : "error";
    return toast[type](error.message, {
      title: getTitle(error)
    });
  }

  showModal(error) {
    const modalApi = openModal({
      eyebrow: getTitle(error),
      title: error.message,
      showSave: false,
      cancelText: getCancelText(error),
      variant: getModalVariant(error),
      body: createErrorBody(error)
    });

    requestAnimationFrame(() => {
      document.querySelector("[data-global-error-retry]")?.addEventListener("click", () => {
        modalApi.close();
        error.retry?.();
      });
    });

    return modalApi;
  }
}

export const errorRenderer = new ErrorRenderer();
export { ErrorRenderer };

function createErrorBody(error) {
  return `
    <div class="modal-detail-grid">
      <span>Loai loi</span><strong>${escapeHtml(error.type)}</strong>
      <span>Ma loi</span><strong>${escapeHtml(error.code)}</strong>
      <span>HTTP Status</span><strong>${error.status || "N/A"}</strong>
      <span>Thoi gian</span><strong>${escapeHtml(error.createdAt)}</strong>
    </div>
    ${createErrorHint(error)}
    ${error.retry ? `
      <button class="modal-primary-button" type="button" data-global-error-retry>
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
        <span>Retry</span>
      </button>
    ` : ""}
  `;
}

function createErrorHint(error) {
  const hints = {
    [ERROR_TYPES.authentication]: "Vui long dang nhap lai de tiep tuc phien lam viec.",
    [ERROR_TYPES.authorization]: "Tai khoan hien tai chua du quyen cho thao tac nay.",
    [ERROR_TYPES.server]: "Neu loi tiep dien, hay kiem tra log backend hoac trang thai API.",
    [ERROR_TYPES.database]: "Loi lien quan tang du lieu. Can kiem tra ket noi MySQL/log backend.",
    [ERROR_TYPES.network]: "Kiem tra ket noi mang hoac backend server.",
    [ERROR_TYPES.timeout]: "Backend phan hoi cham hon timeout hien tai.",
    [ERROR_TYPES.upload]: "Kiem tra dung luong, dinh dang file va thu lai.",
    [ERROR_TYPES.notFound]: "Duong dan hoac tai nguyen khong ton tai.",
    [ERROR_TYPES.validation]: "Kiem tra cac truong bat buoc va dinh dang du lieu."
  };

  return `<p class="modal-danger-copy">${escapeHtml(hints[error.type] ?? "Vui long thu lai hoac kiem tra log he thong.")}</p>`;
}

function getTitle(error) {
  const titles = {
    [ERROR_TYPES.api]: "API Error",
    [ERROR_TYPES.validation]: "Validation Error",
    [ERROR_TYPES.notFound]: "404 Not Found",
    [ERROR_TYPES.server]: "500 Server Error",
    [ERROR_TYPES.network]: "Network Error",
    [ERROR_TYPES.timeout]: "Timeout",
    [ERROR_TYPES.upload]: "Upload Error",
    [ERROR_TYPES.authentication]: "Authentication Error",
    [ERROR_TYPES.authorization]: "Authorization Error",
    [ERROR_TYPES.database]: "Database Error"
  };

  return titles[error.type] ?? "System Error";
}

function getCancelText(error) {
  return error.retry ? "Close" : "OK";
}

function getModalVariant(error) {
  return error.type === ERROR_TYPES.authorization || error.type === ERROR_TYPES.authentication ? "danger" : "system-error";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
