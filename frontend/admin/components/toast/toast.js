const TOAST_TYPES = {
  success: {
    icon: "fa-circle-check",
    title: "Thành công"
  },
  error: {
    icon: "fa-circle-xmark",
    title: "Lỗi"
  },
  warning: {
    icon: "fa-triangle-exclamation",
    title: "Cảnh báo"
  },
  info: {
    icon: "fa-circle-info",
    title: "Thông tin"
  }
};

const DEFAULT_DURATION = 3600;

export const toast = {
  success(message, options = {}) {
    return showToast({ ...options, type: "success", message });
  },
  error(message, options = {}) {
    return showToast({ ...options, type: "error", message });
  },
  warning(message, options = {}) {
    return showToast({ ...options, type: "warning", message });
  },
  info(message, options = {}) {
    return showToast({ ...options, type: "info", message });
  }
};

export function showToast(options = {}) {
  const type = TOAST_TYPES[options.type] ? options.type : "info";
  const duration = options.duration ?? DEFAULT_DURATION;
  const toastElement = document.createElement("article");

  toastElement.className = `toast toast-${type}`;
  toastElement.setAttribute("role", type === "error" ? "alert" : "status");
  toastElement.innerHTML = createToastTemplate({
    type,
    title: options.title ?? TOAST_TYPES[type].title,
    message: options.message ?? "",
    duration
  });

  const container = getToastContainer();
  container.appendChild(toastElement);

  requestAnimationFrame(() => {
    toastElement.classList.add("is-visible");
  });

  const closeTimer = window.setTimeout(() => {
    closeToast(toastElement);
  }, duration);

  toastElement.querySelector("[data-toast-close]")?.addEventListener("click", () => {
    window.clearTimeout(closeTimer);
    closeToast(toastElement);
  });

  return {
    close() {
      window.clearTimeout(closeTimer);
      closeToast(toastElement);
    }
  };
}

function createToastTemplate({ type, title, message, duration }) {
  return `
    <div class="toast-icon" aria-hidden="true">
      <i class="fa-solid ${TOAST_TYPES[type].icon}"></i>
    </div>
    <div class="toast-content">
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
    <button class="toast-close" type="button" aria-label="Đóng thông báo" data-toast-close>
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
    <span class="toast-progress" style="animation-duration: ${duration}ms;"></span>
  `;
}

function getToastContainer() {
  const containers = Array.from(document.querySelectorAll("[data-toast-container]"));
  let container = containers.find((item) => item.parentElement === document.body) || containers[0];

  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    container.dataset.toastContainer = "";
  }

  if (container.parentElement !== document.body) {
    document.body.appendChild(container);
  }

  containers.forEach((item) => {
    if (item !== container && !item.children.length) item.remove();
  });

  return container;
}

function closeToast(toastElement) {
  toastElement.classList.remove("is-visible");
  toastElement.classList.add("is-leaving");

  window.setTimeout(() => {
    toastElement.remove();
  }, 180);
}

