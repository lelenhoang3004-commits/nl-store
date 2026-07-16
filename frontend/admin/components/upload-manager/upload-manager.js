import { toast } from "../toast/toast.js";

const DEFAULT_MAX_SIZE_MB = 3;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const initializedManagers = new WeakSet();

export function initUploadManagers(root = document) {
  root.querySelectorAll("[data-upload-manager]").forEach((element) => {
    if (initializedManagers.has(element)) {
      return;
    }

    initializedManagers.add(element);
    createUploadManager(element);
  });
}

export function createUploadManager(container) {
  const state = {
    items: createExistingItems(container),
    primaryId: "",
    draggedId: "",
    maxSizeMb: Number(container.dataset.maxSizeMb || DEFAULT_MAX_SIZE_MB),
    inputName: container.dataset.inputName || "images",
    required: container.dataset.required === "true",
    timers: new Set()
  };

  container.__uploadManagerCleanup?.();
  container.__uploadManagerCleanup = () => cleanupUploadManager(state);
  state.primaryId = state.items[0]?.id ?? "";
  render(container, state);
  bindEvents(container, state);
  syncInput(container, state);
}

function render(container, state) {
  const validationRules = `${state.required && state.items.length === 0 ? "required|" : ""}image|fileSize:${state.maxSizeMb}`;

  container.classList.add("upload-manager");
  container.innerHTML = `
    <div class="upload-dropzone validation-field" data-upload-dropzone>
      <input type="file" name="${state.inputName}" accept="image/*" multiple data-label="Ảnh" data-validate="${validationRules}" data-upload-input>
      <span class="upload-dropzone-content">
        <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
        <strong>Kéo thả ảnh hoặc chọn từ máy</strong>
        <span>Hỗ trợ JPG, PNG, WEBP, GIF. Tối đa ${state.maxSizeMb}MB mỗi ảnh.</span>
      </span>
    </div>

    <div class="upload-manager-list" data-upload-list>
      ${state.items.map((item, index) => createItemTemplate(item, state, index)).join("")}
    </div>
    <div class="upload-manager-empty ${state.items.length === 0 ? "is-visible" : ""}">Chưa có ảnh nào. Hãy kéo thả ảnh vào vùng upload phía trên.</div>
    <p class="upload-manager-note">Có thể kéo thả để sắp xếp, dùng nút ngôi sao để đổi ảnh đại diện.</p>
  `;
}

function bindEvents(container, state) {
  const dropzone = container.querySelector("[data-upload-dropzone]");
  const input = container.querySelector("[data-upload-input]");

  dropzone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    addFiles(container, state, Array.from(input.files));
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, () => {
      dropzone.classList.remove("is-dragging");
    });
  });

  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    addFiles(container, state, Array.from(event.dataTransfer.files));
  });

  bindListEvents(container, state);
}

function bindListEvents(container, state) {
  container.querySelectorAll("[data-upload-primary]").forEach((button) => {
    button.addEventListener("click", () => {
      state.primaryId = button.dataset.uploadPrimary;
      renderAndRebind(container, state);
      toast.info("Đã đổi ảnh đại diện trên giao diện mẫu.");
    });
  });

  container.querySelectorAll("[data-upload-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = getItem(state, button.dataset.uploadRemove);

      if (item?.objectUrl) {
        URL.revokeObjectURL(item.src);
      }

      state.items = state.items.filter((image) => image.id !== button.dataset.uploadRemove);

      if (state.primaryId === button.dataset.uploadRemove) {
        state.primaryId = state.items[0]?.id ?? "";
      }

      renderAndRebind(container, state);
      toast.warning("Đã xóa ảnh khỏi danh sách upload mẫu.");
    });
  });

  container.querySelectorAll("[data-upload-move]").forEach((button) => {
    button.addEventListener("click", () => {
      moveItem(state, button.dataset.uploadMove, Number(button.dataset.direction));
      renderAndRebind(container, state);
    });
  });

  container.querySelectorAll("[data-upload-item]").forEach((itemElement) => {
    itemElement.addEventListener("dragstart", () => {
      state.draggedId = itemElement.dataset.uploadItem;
    });

    itemElement.addEventListener("dragover", (event) => {
      event.preventDefault();
      itemElement.classList.add("is-drag-over");
    });

    itemElement.addEventListener("dragleave", () => {
      itemElement.classList.remove("is-drag-over");
    });

    itemElement.addEventListener("drop", (event) => {
      event.preventDefault();
      itemElement.classList.remove("is-drag-over");
      reorderByDrag(state, state.draggedId, itemElement.dataset.uploadItem);
      state.draggedId = "";
      renderAndRebind(container, state);
    });
  });
}

function addFiles(container, state, files) {
  const validFiles = files.filter((file) => validateFile(file, state));

  if (validFiles.length === 0) {
    syncInput(container, state);
    return;
  }

  const newItems = validFiles.map((file) => ({
    id: createId(),
    file,
    name: file.name,
    size: file.size,
    src: URL.createObjectURL(file),
    objectUrl: true,
    progress: 0
  }));

  state.items = [...state.items, ...newItems];
  state.primaryId = state.primaryId || newItems[0].id;
  renderAndRebind(container, state);
  simulateProgress(container, state, newItems.map((item) => item.id));
  toast.success(`Đã thêm ${newItems.length} ảnh vào Upload Manager.`);
}

function validateFile(file, state) {
  if (!IMAGE_TYPES.includes(file.type)) {
    toast.error(`${file.name} không đúng định dạng ảnh.`);
    return false;
  }

  if (file.size > state.maxSizeMb * 1024 * 1024) {
    toast.error(`${file.name} vượt quá ${state.maxSizeMb}MB.`);
    return false;
  }

  return true;
}

function simulateProgress(container, state, itemIds) {
  const timer = window.setInterval(() => {
    let isDone = true;

    state.items = state.items.map((item) => {
      if (!itemIds.includes(item.id) || item.progress >= 100) {
        return item;
      }

      const progress = Math.min(100, item.progress + 24);
      isDone = isDone && progress >= 100;
      return { ...item, progress };
    });

    updateProgress(container, state);

    if (isDone) {
      window.clearInterval(timer);
      state.timers.delete(timer);
    }
  }, 120);

  state.timers.add(timer);
}

function updateProgress(container, state) {
  state.items.forEach((item) => {
    const progress = container.querySelector(`[data-upload-progress="${item.id}"]`);
    const percent = container.querySelector(`[data-upload-percent="${item.id}"]`);

    if (progress) {
      progress.style.setProperty("--upload-progress", `${item.progress}%`);
    }

    if (percent) {
      percent.textContent = item.progress >= 100 ? "Sẵn sàng" : `${item.progress}%`;
    }
  });
}

function renderAndRebind(container, state) {
  render(container, state);
  bindEvents(container, state);
  syncInput(container, state);
}

function syncInput(container, state) {
  const input = container.querySelector("[data-upload-input]");

  if (!input) {
    return;
  }

  const dataTransfer = new DataTransfer();
  state.items.forEach((item) => {
    if (item.file) {
      dataTransfer.items.add(item.file);
    }
  });
  input.files = dataTransfer.files;
}

function createItemTemplate(item, state, index) {
  const isPrimary = item.id === state.primaryId;

  return `
    <article class="upload-item ${isPrimary ? "is-primary" : ""}" draggable="true" data-upload-item="${item.id}">
      <div class="upload-item-preview">
        <img src="${item.src}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">
        ${isPrimary ? `
          <span class="upload-primary-badge">
            <i class="fa-solid fa-star" aria-hidden="true"></i>
            Đại diện
          </span>
        ` : ""}
      </div>
      <div class="upload-progress" data-upload-progress="${item.id}" style="--upload-progress: ${item.progress}%;">
        <span></span>
      </div>
      <div class="upload-item-meta">
        <strong>${escapeHtml(item.name)}</strong>
        <span data-upload-percent="${item.id}">${item.progress >= 100 ? "Sẵn sàng" : `${item.progress}%`}</span>
        <span>${formatFileSize(item.size)}</span>
      </div>
      <div class="upload-item-actions">
        <button type="button" title="Lên trước" data-upload-move="${item.id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>
          <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        </button>
        <button type="button" title="Xuống sau" data-upload-move="${item.id}" data-direction="1" ${index === state.items.length - 1 ? "disabled" : ""}>
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
        <button type="button" title="Đặt làm ảnh đại diện" data-upload-primary="${item.id}">
          <i class="fa-${isPrimary ? "solid" : "regular"} fa-star" aria-hidden="true"></i>
        </button>
        <button type="button" title="Xóa ảnh" data-upload-remove="${item.id}">
          <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>
    </article>
  `;
}

function createExistingItems(container) {
  const images = (container.dataset.existingImages || "")
    .split("|")
    .map((image) => image.trim())
    .filter(Boolean);

  return images.map((image, index) => ({
    id: createId(),
    name: `Ảnh hiện tại ${index + 1}`,
    size: 0,
    src: image,
    progress: 100
  }));
}

function moveItem(state, id, direction) {
  const currentIndex = state.items.findIndex((item) => item.id === id);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= state.items.length) {
    return;
  }

  const items = [...state.items];
  const [movedItem] = items.splice(currentIndex, 1);
  items.splice(nextIndex, 0, movedItem);
  state.items = items;
}

function reorderByDrag(state, draggedId, targetId) {
  if (!draggedId || draggedId === targetId) {
    return;
  }

  const draggedIndex = state.items.findIndex((item) => item.id === draggedId);
  const targetIndex = state.items.findIndex((item) => item.id === targetId);

  if (draggedIndex < 0 || targetIndex < 0) {
    return;
  }

  const items = [...state.items];
  const [draggedItem] = items.splice(draggedIndex, 1);
  items.splice(targetIndex, 0, draggedItem);
  state.items = items;
}

function getItem(state, id) {
  return state.items.find((item) => item.id === id);
}

function formatFileSize(size) {
  if (!size) {
    return "Ảnh có sẵn";
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)}KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function createId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanupUploadManager(state) {
  state.timers.forEach((timer) => window.clearInterval(timer));
  state.timers.clear();

  state.items.forEach((item) => {
    if (item.objectUrl && item.src) {
      URL.revokeObjectURL(item.src);
    }
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
