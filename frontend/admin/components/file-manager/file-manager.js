import { confirmDialog } from "../confirm/confirm.js";
import { openModal } from "../modal/modal.js";
import { toast } from "../toast/toast.js";

const STORAGE_LIMIT_BYTES = 512 * 1024 * 1024;
const initializedManagers = new WeakSet();

const mockFolders = [
  { id: "all", name: "Tất cả", icon: "fa-folder-open" },
  { id: "products", name: "Sản phẩm", icon: "fa-shirt" },
  { id: "banners", name: "Banner", icon: "fa-image" },
  { id: "documents", name: "Tài liệu", icon: "fa-file-lines" },
  { id: "videos", name: "Video", icon: "fa-video" }
];

const mockFiles = [
  {
    id: "file-1001",
    name: "linen-blazer-cover.jpg",
    folderId: "products",
    type: "image/jpeg",
    size: 1240000,
    url: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80",
    createdAt: "2026-07-06"
  },
  {
    id: "file-1002",
    name: "summer-campaign-banner.webp",
    folderId: "banners",
    type: "image/webp",
    size: 1640000,
    url: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
    createdAt: "2026-07-05"
  },
  {
    id: "file-1003",
    name: "fashion-store-policy.pdf",
    folderId: "documents",
    type: "application/pdf",
    size: 840000,
    url: "",
    createdAt: "2026-07-03"
  },
  {
    id: "file-1004",
    name: "product-launch-preview.mp4",
    folderId: "videos",
    type: "video/mp4",
    size: 18600000,
    url: "",
    createdAt: "2026-07-02"
  },
  {
    id: "file-1005",
    name: "sneaker-gallery.png",
    folderId: "products",
    type: "image/png",
    size: 980000,
    url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    createdAt: "2026-07-01"
  }
];

export function createFileManagerTemplate() {
  return `
    <section class="file-manager" data-file-manager>
      <input class="file-manager-input" type="file" multiple data-file-upload-input>
      <header class="file-manager-header">
        <div>
          <p class="file-manager-eyebrow">Media Library</p>
          <h2>File Manager</h2>
        </div>
        <div class="file-manager-actions">
          <button class="file-manager-secondary" type="button" data-file-folder-create>
            <i class="fa-regular fa-folder" aria-hidden="true"></i>
            <span>Folder</span>
          </button>
          <button class="file-manager-primary" type="button" data-file-upload-trigger>
            <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
            <span>Upload</span>
          </button>
        </div>
      </header>
      <div data-file-manager-content></div>
    </section>
  `;
}

export function initFileManagers(root = document) {
  root.querySelectorAll("[data-file-manager]").forEach((element) => {
    if (initializedManagers.has(element)) {
      return;
    }

    initializedManagers.add(element);
    createFileManager(element);
  });
}

export function createFileManager(container) {
  const state = {
    files: mockFiles.map((file) => ({ ...file })),
    folders: mockFolders.map((folder) => ({ ...folder })),
    folderId: "all",
    query: "",
    view: "grid",
    selectedId: ""
  };

  container.__fileManagerCleanup?.();
  container.__fileManagerCleanup = () => cleanupFileManager(state);
  render(container, state);
  bindEvents(container, state);
}

export function destroyFileManager(container) {
  container?.__fileManagerCleanup?.();
}

function bindEvents(container, state) {
  const input = container.querySelector("[data-file-upload-input]");

  container.addEventListener("click", async (event) => {
    const uploadTrigger = event.target.closest("[data-file-upload-trigger]");
    const folderButton = event.target.closest("[data-file-folder]");
    const viewButton = event.target.closest("[data-file-view]");
    const previewButton = event.target.closest("[data-file-preview]");
    const renameButton = event.target.closest("[data-file-rename]");
    const deleteButton = event.target.closest("[data-file-delete]");
    const createFolderButton = event.target.closest("[data-file-folder-create]");

    if (uploadTrigger) {
      input.click();
      return;
    }

    if (folderButton) {
      state.folderId = folderButton.dataset.fileFolder;
      render(container, state);
      return;
    }

    if (viewButton) {
      state.view = viewButton.dataset.fileView;
      render(container, state);
      return;
    }

    if (previewButton) {
      openPreviewModal(getFile(state, previewButton.dataset.filePreview));
      return;
    }

    if (renameButton) {
      openRenameModal(container, state, renameButton.dataset.fileRename);
      return;
    }

    if (deleteButton) {
      await deleteFile(container, state, deleteButton.dataset.fileDelete);
      return;
    }

    if (createFolderButton) {
      openFolderModal(container, state);
    }
  });

  container.addEventListener("input", (event) => {
    const searchInput = event.target.closest("[data-file-search]");

    if (!searchInput) {
      return;
    }

    state.query = searchInput.value;
    render(container, state, { keepSearchFocus: true });
  });

  input.addEventListener("change", () => {
    addFiles(container, state, Array.from(input.files));
    input.value = "";
  });
}

function render(container, state, options = {}) {
  const content = container.querySelector("[data-file-manager-content]");
  const files = getVisibleFiles(state);

  content.innerHTML = `
    <div class="file-manager-layout">
      <aside class="file-manager-sidebar">
        <div class="file-manager-storage">
          ${createStorageTemplate(state)}
        </div>
        <nav class="file-manager-folders" aria-label="Thư mục">
          ${state.folders.map((folder) => createFolderTemplate(folder, state)).join("")}
        </nav>
      </aside>

      <section class="file-manager-content">
        <div class="file-manager-toolbar">
          <label class="file-manager-search">
            <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input type="search" value="${escapeHtml(state.query)}" placeholder="Tìm file, ảnh, tài liệu" data-file-search>
          </label>
          <div class="file-manager-view-toggle" aria-label="Chế độ hiển thị">
            <button type="button" class="${state.view === "grid" ? "is-active" : ""}" data-file-view="grid" title="Grid">
              <i class="fa-solid fa-grip" aria-hidden="true"></i>
            </button>
            <button type="button" class="${state.view === "list" ? "is-active" : ""}" data-file-view="list" title="List">
              <i class="fa-solid fa-list" aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div class="file-manager-summary">
          <strong>${files.length} file</strong>
          <span>${getCurrentFolderName(state)} · ${formatFileSize(getStorageUsed(state))} đang sử dụng</span>
        </div>

        <div class="file-manager-files file-manager-${state.view}">
          ${files.length > 0 ? files.map((file) => createFileTemplate(file, state.view)).join("") : createEmptyState()}
        </div>
      </section>
    </div>
  `;

  if (options.keepSearchFocus) {
    const searchInput = content.querySelector("[data-file-search]");
    searchInput?.focus({ preventScroll: true });
    searchInput?.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }
}

function addFiles(container, state, files) {
  const validFiles = files.filter(Boolean);

  if (validFiles.length === 0) {
    return;
  }

  const targetFolder = state.folderId === "all" ? "products" : state.folderId;
  const newFiles = validFiles.map((file) => ({
    id: createId(),
    name: file.name,
    folderId: targetFolder,
    type: file.type || "application/octet-stream",
    size: file.size,
    url: URL.createObjectURL(file),
    objectUrl: true,
    createdAt: new Date().toISOString().slice(0, 10)
  }));

  state.files = [...newFiles, ...state.files];
  render(container, state);
  toast.success(`Đã thêm ${newFiles.length} file vào File Manager.`);
}

async function deleteFile(container, state, fileId) {
  const file = getFile(state, fileId);

  if (!file) {
    return;
  }

  const confirmed = await confirmDialog({
    type: "danger",
    icon: "fa-trash-can",
    title: "Xóa file",
    message: `Bạn có chắc chắn muốn xóa ${escapeHtml(file.name)}? Đây là thao tác mô phỏng giao diện.`,
    confirmText: "Xóa",
    cancelText: "Hủy"
  });

  if (!confirmed) {
    return;
  }

  if (file.objectUrl) {
    URL.revokeObjectURL(file.url);
  }

  state.files = state.files.filter((item) => item.id !== fileId);
  render(container, state);
  toast.warning("Đã xóa file khỏi File Manager mẫu.");
}

function openRenameModal(container, state, fileId) {
  const file = getFile(state, fileId);

  if (!file) {
    return;
  }

  openModal({
    eyebrow: "File Manager",
    title: "Đổi tên file",
    saveText: "Rename",
    successMessage: "Đã đổi tên file trên giao diện mẫu.",
    body: `
      <div class="modal-form-grid" data-validate-form>
        <div class="validation-summary" data-validation-summary></div>
        <label class="validation-field">
          <span>Tên file</span>
          <input type="text" value="${escapeHtml(file.name)}" data-label="Tên file" data-validate="required|min:2|max:120" data-file-rename-input>
        </label>
      </div>
    `,
    onSave() {
      const input = document.querySelector("[data-file-rename-input]");
      const nextName = input?.value.trim();

      if (!nextName) {
        toast.error("Tên file không được để trống.");
        return;
      }

      state.files = state.files.map((item) => (
        item.id === fileId ? { ...item, name: nextName } : item
      ));
      render(container, state);
    }
  });
}

function openFolderModal(container, state) {
  openModal({
    eyebrow: "File Manager",
    title: "Tạo folder",
    saveText: "Create",
    successMessage: "Đã tạo folder trên giao diện mẫu.",
    body: `
      <div class="modal-form-grid" data-validate-form>
        <div class="validation-summary" data-validation-summary></div>
        <label class="validation-field">
          <span>Tên folder</span>
          <input type="text" placeholder="Ví dụ: Lookbook" data-label="Tên folder" data-validate="required|min:2|max:60" data-file-folder-input>
        </label>
      </div>
    `,
    onSave() {
      const input = document.querySelector("[data-file-folder-input]");
      const folderName = input?.value.trim();

      if (!folderName) {
        toast.error("Tên folder không được để trống.");
        return;
      }

      const folder = {
        id: slugify(folderName),
        name: folderName,
        icon: "fa-folder"
      };
      state.folders = [...state.folders, folder];
      state.folderId = folder.id;
      render(container, state);
    }
  });
}

function openPreviewModal(file) {
  if (!file) {
    return;
  }

  openModal({
    eyebrow: getFileCategory(file),
    title: file.name,
    showSave: false,
    cancelText: "Đóng",
    variant: "file-preview",
    body: createPreviewTemplate(file)
  });
}

function createStorageTemplate(state) {
  const used = getStorageUsed(state);
  const percent = Math.min(100, Math.round((used / STORAGE_LIMIT_BYTES) * 100));

  return `
    <div class="file-storage-ring" style="--file-storage-percent: ${percent}%;">
      <strong>${percent}%</strong>
      <span>Storage</span>
    </div>
    <div>
      <strong>${formatFileSize(used)}</strong>
      <span>/ ${formatFileSize(STORAGE_LIMIT_BYTES)}</span>
    </div>
  `;
}

function createFolderTemplate(folder, state) {
  const total = folder.id === "all"
    ? state.files.length
    : state.files.filter((file) => file.folderId === folder.id).length;

  return `
    <button type="button" class="${state.folderId === folder.id ? "is-active" : ""}" data-file-folder="${folder.id}">
      <i class="fa-solid ${folder.icon}" aria-hidden="true"></i>
      <span>${escapeHtml(folder.name)}</span>
      <small>${total}</small>
    </button>
  `;
}

function createFileTemplate(file, view) {
  return `
    <article class="file-card file-${getFileCategory(file)}">
      <button class="file-preview-button" type="button" data-file-preview="${file.id}">
        ${createFilePreviewThumb(file)}
      </button>
      <div class="file-card-meta">
        <strong>${escapeHtml(file.name)}</strong>
        <span>${formatFileSize(file.size)} · ${formatDate(file.createdAt)}</span>
      </div>
      <div class="file-card-actions">
        <button type="button" title="Preview" data-file-preview="${file.id}">
          <i class="fa-regular fa-eye" aria-hidden="true"></i>
        </button>
        <button type="button" title="Rename" data-file-rename="${file.id}">
          <i class="fa-regular fa-pen-to-square" aria-hidden="true"></i>
        </button>
        <button type="button" title="Delete" data-file-delete="${file.id}">
          <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>
      ${view === "list" ? `<span class="file-card-type">${escapeHtml(file.type || "unknown")}</span>` : ""}
    </article>
  `;
}

function createFilePreviewThumb(file) {
  if (isImage(file) && file.url) {
    return `<img src="${file.url}" alt="${escapeHtml(file.name)}" loading="lazy" decoding="async">`;
  }

  return `
    <span class="file-icon-preview">
      <i class="fa-solid ${getFileIcon(file)}" aria-hidden="true"></i>
    </span>
  `;
}

function createPreviewTemplate(file) {
  const meta = `
    <div class="modal-detail-grid">
      <span>Folder</span><strong>${escapeHtml(file.folderId)}</strong>
      <span>Type</span><strong>${escapeHtml(file.type || "unknown")}</strong>
      <span>Size</span><strong>${formatFileSize(file.size)}</strong>
      <span>Created</span><strong>${formatDate(file.createdAt)}</strong>
    </div>
  `;

  if (isImage(file) && file.url) {
    return `
      <div class="file-preview-modal">
        <img src="${file.url}" alt="${escapeHtml(file.name)}" decoding="async">
        ${meta}
      </div>
    `;
  }

  if (isPdf(file) && file.url) {
    return `
      <div class="file-preview-modal">
        <iframe src="${file.url}" title="${escapeHtml(file.name)}"></iframe>
        ${meta}
      </div>
    `;
  }

  if (isVideo(file) && file.url) {
    return `
      <div class="file-preview-modal">
        <video src="${file.url}" controls></video>
        ${meta}
      </div>
    `;
  }

  return `
    <div class="file-preview-modal file-preview-unavailable">
      <i class="fa-solid ${getFileIcon(file)}" aria-hidden="true"></i>
      <strong>Preview chưa khả dụng</strong>
      <p>File mẫu này chưa có nguồn cục bộ để preview. Khi upload file thật trong trình duyệt, preview sẽ dùng object URL.</p>
      ${meta}
    </div>
  `;
}

function createEmptyState() {
  return `
    <div class="file-manager-empty">
      <i class="fa-regular fa-folder-open" aria-hidden="true"></i>
      <strong>Không có file</strong>
      <span>Thử đổi folder, từ khóa tìm kiếm hoặc upload file mới.</span>
    </div>
  `;
}

function getVisibleFiles(state) {
  const query = state.query.trim().toLowerCase();

  return state.files
    .filter((file) => state.folderId === "all" || file.folderId === state.folderId)
    .filter((file) => {
      if (!query) {
        return true;
      }

      return `${file.name} ${file.type} ${file.folderId}`.toLowerCase().includes(query);
    });
}

function getCurrentFolderName(state) {
  return state.folders.find((folder) => folder.id === state.folderId)?.name ?? "Tất cả";
}

function getStorageUsed(state) {
  return state.files.reduce((total, file) => total + Number(file.size || 0), 0);
}

function getFile(state, fileId) {
  return state.files.find((file) => file.id === fileId);
}

function getFileCategory(file) {
  if (isImage(file)) {
    return "image";
  }

  if (isPdf(file)) {
    return "pdf";
  }

  if (isVideo(file)) {
    return "video";
  }

  return "file";
}

function getFileIcon(file) {
  if (isPdf(file)) {
    return "fa-file-pdf";
  }

  if (isVideo(file)) {
    return "fa-file-video";
  }

  if (isImage(file)) {
    return "fa-file-image";
  }

  return "fa-file";
}

function isImage(file) {
  return String(file.type).startsWith("image/");
}

function isPdf(file) {
  return file.type === "application/pdf";
}

function isVideo(file) {
  return String(file.type).startsWith("video/");
}

function formatFileSize(size) {
  const value = Number(size || 0);

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))}KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanupFileManager(state) {
  state.files.forEach((file) => {
    if (file.objectUrl && file.url) {
      URL.revokeObjectURL(file.url);
    }
  });
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || createId();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
