import { openModal } from "../components/modal/modal.js";

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
      <span>Loại lỗi</span><strong>${escapeHtml(error.type)}</strong>
      <span>Mã lỗi</span><strong>${escapeHtml(error.code)}</strong>
      <span>HTTP Status</span><strong>${error.status || "N/A"}</strong>
      <span>Thời gian</span><strong>${escapeHtml(error.createdAt)}</strong>
    </div>
    ${createErrorHint(error)}
    ${error.retry ? `
      <button class="modal-primary-button" type="button" data-global-error-retry>
        <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>
        <span>Thử lại</span>
      </button>
    ` : ""}
  `;
}

function createErrorHint(error) {
  const hints = {
    [ERROR_TYPES.authentication]: "Vui lòng đăng nhập lại để tiếp tục phiên làm việc.",
    [ERROR_TYPES.authorization]: "Tài khoản hiện tại chưa đủ quyền cho thao tác này.",
    [ERROR_TYPES.server]: "Nếu lỗi tiếp diễn, hãy kiểm tra log backend hoặc trạng thái API.",
    [ERROR_TYPES.database]: "Lỗi liên quan tầng dữ liệu. Cần kiểm tra kết nối MySQL/log backend.",
    [ERROR_TYPES.network]: "Kiểm tra kết nối mạng hoặc backend server.",
    [ERROR_TYPES.timeout]: "Backend phản hồi chậm hơn timeout hiện tại.",
    [ERROR_TYPES.upload]: "Kiểm tra dung lượng, định dạng file và thử lại.",
    [ERROR_TYPES.notFound]: "Đường dẫn hoặc tài nguyên không tồn tại.",
    [ERROR_TYPES.validation]: "Kiểm tra các trường bắt buộc và định dạng dữ liệu."
  };

  return `<p class="modal-danger-copy">${escapeHtml(hints[error.type] ?? "Vui lòng thử lại hoặc kiểm tra log hệ thống.")}</p>`;
}

function getTitle(error) {
  const titles = {
    [ERROR_TYPES.api]: "Lỗi API",
    [ERROR_TYPES.validation]: "Lỗi dữ liệu",
    [ERROR_TYPES.notFound]: "404 Không tìm thấy",
    [ERROR_TYPES.server]: "500 Lỗi máy chủ",
    [ERROR_TYPES.network]: "Lỗi mạng",
    [ERROR_TYPES.timeout]: "Timeout",
    [ERROR_TYPES.upload]: "Lỗi upload",
    [ERROR_TYPES.authentication]: "Lỗi xác thực",
    [ERROR_TYPES.authorization]: "Lỗi phân quyền",
    [ERROR_TYPES.database]: "Lỗi dữ liệu"
  };

  return titles[error.type] ?? "Lỗi hệ thống";
}

function getCancelText(error) {
  return error.retry ? "Đóng" : "OK";
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

