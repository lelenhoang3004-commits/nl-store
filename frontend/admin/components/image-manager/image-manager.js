import { openModal } from "../modal/modal.js";
import { toast } from "../toast/toast.js";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const DEFAULT_QUALITY = 0.82;
const initializedManagers = new WeakSet();

export function createImageManagerTemplate() {
  return `
    <section class="image-manager" data-image-manager>
      <input class="image-manager-input" type="file" accept="image/*" multiple data-image-input>
      <header class="image-manager-header">
        <div>
          <p class="image-manager-eyebrow">Media Tools</p>
          <h2>Image Manager</h2>
          <span>Upload, preview, crop, resize, compress và chuẩn bị WebP trên trình duyệt.</span>
        </div>
        <button class="image-manager-primary" type="button" data-image-upload-trigger>
          <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i>
          <span>Upload Images</span>
        </button>
      </header>

      <div class="image-manager-dropzone" data-image-dropzone>
        <i class="fa-solid fa-images" aria-hidden="true"></i>
        <strong>Kéo thả nhiều ảnh vào đây</strong>
        <span>Hỗ trợ JPG, PNG, WEBP, GIF. Xử lý preview và tối ưu ngay trên browser.</span>
      </div>

      <div class="image-manager-toolbar">
        <label>
          <span>Resize width</span>
          <input type="number" min="120" step="10" value="1200" data-image-resize-width>
        </label>
        <label>
          <span>Quality</span>
          <input type="range" min="0.4" max="1" step="0.05" value="${DEFAULT_QUALITY}" data-image-quality>
        </label>
        <label class="image-manager-check">
          <input type="checkbox" checked data-image-webp>
          <span>WebP ready</span>
        </label>
        <button type="button" data-image-compress-all>
          <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
          <span>Compress All</span>
        </button>
      </div>

      <div class="image-manager-grid" data-image-grid></div>
      <div class="image-manager-empty" data-image-empty>
        <i class="fa-regular fa-image" aria-hidden="true"></i>
        <strong>Chưa có ảnh</strong>
        <span>Upload hoặc kéo thả ảnh để bắt đầu.</span>
      </div>
    </section>
  `;
}

export function initImageManagers(root = document) {
  root.querySelectorAll("[data-image-manager]").forEach((container) => {
    if (initializedManagers.has(container)) {
      return;
    }

    initializedManagers.add(container);
    createImageManager(container);
  });
}

export function createImageManager(container) {
  const state = {
    images: [],
    draggedId: "",
    destroyed: false
  };

  container.__imageManagerCleanup?.();
  container.__imageManagerCleanup = () => cleanupImageManager(state);
  render(container, state);
  bindEvents(container, state);
}

export function destroyImageManager(container) {
  container?.__imageManagerCleanup?.();
}

function bindEvents(container, state) {
  const input = container.querySelector("[data-image-input]");
  const dropzone = container.querySelector("[data-image-dropzone]");

  container.querySelector("[data-image-upload-trigger]")?.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    addImages(container, state, Array.from(input.files));
    input.value = "";
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
    addImages(container, state, Array.from(event.dataTransfer.files));
  });

  container.addEventListener("click", async (event) => {
    const previewButton = event.target.closest("[data-image-preview]");
    const compressButton = event.target.closest("[data-image-compress]");
    const cropButton = event.target.closest("[data-image-crop]");
    const resizeButton = event.target.closest("[data-image-resize]");
    const removeButton = event.target.closest("[data-image-remove]");
    const compressAllButton = event.target.closest("[data-image-compress-all]");

    if (previewButton) {
      openImagePreview(getImage(state, previewButton.dataset.imagePreview));
      return;
    }

    if (compressButton) {
      await optimizeImage(container, state, compressButton.dataset.imageCompress);
      return;
    }

    if (cropButton) {
      await cropImage(container, state, cropButton.dataset.imageCrop);
      return;
    }

    if (resizeButton) {
      await resizeImage(container, state, resizeButton.dataset.imageResize);
      return;
    }

    if (removeButton) {
      removeImage(container, state, removeButton.dataset.imageRemove);
      return;
    }

    if (compressAllButton) {
      await compressAll(container, state);
    }
  });

  container.addEventListener("dragstart", (event) => {
    const item = event.target.closest("[data-image-item]");

    if (item) {
      state.draggedId = item.dataset.imageItem;
    }
  });

  container.addEventListener("dragover", (event) => {
    const item = event.target.closest("[data-image-item]");

    if (item) {
      event.preventDefault();
      item.classList.add("is-drag-over");
    }
  });

  container.addEventListener("dragleave", (event) => {
    event.target.closest("[data-image-item]")?.classList.remove("is-drag-over");
  });

  container.addEventListener("drop", (event) => {
    const item = event.target.closest("[data-image-item]");

    if (!item || !state.draggedId) {
      return;
    }

    event.preventDefault();
    item.classList.remove("is-drag-over");
    reorderImages(state, state.draggedId, item.dataset.imageItem);
    state.draggedId = "";
    render(container, state);
  });
}

function render(container, state) {
  if (state.destroyed) {
    return;
  }

  const grid = container.querySelector("[data-image-grid]");
  const empty = container.querySelector("[data-image-empty]");

  grid.innerHTML = state.images.map(createImageCard).join("");
  empty.classList.toggle("is-visible", state.images.length === 0);
}

function addImages(container, state, files) {
  const validFiles = files.filter(validateImageFile);

  if (validFiles.length === 0) {
    return;
  }

  const images = validFiles.map((file) => ({
    id: createId(),
    file,
    name: file.name,
    type: file.type,
    size: file.size,
    originalSize: file.size,
    width: 0,
    height: 0,
    src: URL.createObjectURL(file),
    optimized: false
  }));

  state.images = [...images, ...state.images];
  render(container, state);
  hydrateImageDimensions(container, state, images);
  toast.success(`Đã thêm ${images.length} ảnh vào Image Manager.`);
}

function validateImageFile(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    toast.error(`${file.name} không đúng định dạng ảnh.`);
    return false;
  }

  return true;
}

function hydrateImageDimensions(container, state, images) {
  images.forEach((image) => {
    const probe = new Image();
    probe.onload = () => {
      if (state.destroyed) {
        return;
      }

      image.width = probe.naturalWidth;
      image.height = probe.naturalHeight;
      render(container, state);
    };
    probe.src = image.src;
  });
}

async function optimizeImage(container, state, imageId) {
  const image = getImage(state, imageId);

  if (!image) {
    return;
  }

  const options = getProcessingOptions(container);
  const processed = await processImage(image, {
    width: Math.min(options.width, image.width || options.width),
    quality: options.quality,
    mimeType: options.webp ? "image/webp" : image.type
  });

  replaceImageObjectUrl(image, processed);
  image.optimized = true;
  render(container, state);
  toast.success("Đã compress ảnh trên trình duyệt.");
}

async function resizeImage(container, state, imageId) {
  const image = getImage(state, imageId);

  if (!image) {
    return;
  }

  const options = getProcessingOptions(container);
  const processed = await processImage(image, {
    width: options.width,
    quality: options.quality,
    mimeType: options.webp ? "image/webp" : image.type
  });

  replaceImageObjectUrl(image, processed);
  image.optimized = true;
  render(container, state);
  toast.info("Đã resize ảnh trên giao diện mẫu.");
}

async function cropImage(container, state, imageId) {
  const image = getImage(state, imageId);

  if (!image) {
    return;
  }

  const options = getProcessingOptions(container);
  const cropSize = Math.min(image.width || 800, image.height || 800);
  const processed = await processImage(image, {
    width: cropSize,
    height: cropSize,
    crop: true,
    quality: options.quality,
    mimeType: options.webp ? "image/webp" : image.type
  });

  replaceImageObjectUrl(image, processed);
  image.optimized = true;
  render(container, state);
  toast.info("Đã crop ảnh dạng vuông.");
}

async function compressAll(container, state) {
  if (state.images.length === 0) {
    toast.info("Chưa có ảnh để compress.");
    return;
  }

  for (const image of state.images) {
    await optimizeImage(container, state, image.id);
  }
}

function processImage(image, options) {
  return new Promise((resolve, reject) => {
    const source = new Image();
    source.onload = () => {
      const sourceWidth = source.naturalWidth;
      const sourceHeight = source.naturalHeight;
      const targetWidth = Math.min(options.width || sourceWidth, sourceWidth);
      const ratio = targetWidth / sourceWidth;
      const targetHeight = options.height || Math.round(sourceHeight * ratio);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      if (options.crop) {
        const cropSize = Math.min(sourceWidth, sourceHeight);
        const sx = Math.round((sourceWidth - cropSize) / 2);
        const sy = Math.round((sourceHeight - cropSize) / 2);
        context.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, targetWidth, targetHeight);
      } else {
        context.drawImage(source, 0, 0, targetWidth, targetHeight);
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Cannot process image."));
          return;
        }

        resolve({
          blob,
          src: URL.createObjectURL(blob),
          size: blob.size,
          type: blob.type,
          width: targetWidth,
          height: targetHeight
        });
      }, options.mimeType, options.quality);
    };
    source.onerror = reject;
    source.src = image.src;
  });
}

function replaceImageObjectUrl(image, processed) {
  URL.revokeObjectURL(image.src);
  image.src = processed.src;
  image.size = processed.size;
  image.type = processed.type;
  image.width = processed.width;
  image.height = processed.height;
  image.name = getProcessedName(image.name, processed.type);
}

function removeImage(container, state, imageId) {
  const image = getImage(state, imageId);

  if (image) {
    URL.revokeObjectURL(image.src);
  }

  state.images = state.images.filter((item) => item.id !== imageId);
  render(container, state);
  toast.warning("Đã xóa ảnh khỏi Image Manager.");
}

function openImagePreview(image) {
  if (!image) {
    return;
  }

  openModal({
    eyebrow: image.type,
    title: image.name,
    showSave: false,
    cancelText: "Đóng",
    variant: "image-preview",
    body: `
      <div class="image-manager-preview">
        <img src="${image.src}" alt="${escapeHtml(image.name)}" decoding="async">
        <div class="modal-detail-grid">
          <span>Kích thước</span><strong>${image.width || "N/A"} × ${image.height || "N/A"}</strong>
          <span>Dung lượng</span><strong>${formatFileSize(image.size)}</strong>
          <span>Gốc</span><strong>${formatFileSize(image.originalSize)}</strong>
          <span>WebP Ready</span><strong>${image.type === "image/webp" ? "Yes" : "Pending"}</strong>
        </div>
      </div>
    `
  });
}

function createImageCard(image) {
  const savedPercent = image.originalSize
    ? Math.max(0, Math.round((1 - image.size / image.originalSize) * 100))
    : 0;

  return `
    <article class="image-manager-card ${image.optimized ? "is-optimized" : ""}" draggable="true" data-image-item="${image.id}">
      <button class="image-manager-thumb" type="button" data-image-preview="${image.id}">
        <img src="${image.src}" alt="${escapeHtml(image.name)}" loading="lazy" decoding="async">
        ${image.type === "image/webp" ? `<span class="image-webp-badge">WebP</span>` : ""}
      </button>
      <div class="image-manager-meta">
        <strong>${escapeHtml(image.name)}</strong>
        <span>${image.width || "-"}×${image.height || "-"} · ${formatFileSize(image.size)}</span>
        <span>${savedPercent > 0 ? `Saved ${savedPercent}%` : "Original"}</span>
      </div>
      <div class="image-manager-card-actions">
        <button type="button" title="Preview" data-image-preview="${image.id}">
          <i class="fa-regular fa-eye" aria-hidden="true"></i>
        </button>
        <button type="button" title="Crop" data-image-crop="${image.id}">
          <i class="fa-solid fa-crop-simple" aria-hidden="true"></i>
        </button>
        <button type="button" title="Resize" data-image-resize="${image.id}">
          <i class="fa-solid fa-up-right-and-down-left-from-center" aria-hidden="true"></i>
        </button>
        <button type="button" title="Compress" data-image-compress="${image.id}">
          <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        </button>
        <button type="button" title="Delete" data-image-remove="${image.id}">
          <i class="fa-regular fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>
    </article>
  `;
}

function getProcessingOptions(container) {
  return {
    width: Number(container.querySelector("[data-image-resize-width]")?.value || 1200),
    quality: Number(container.querySelector("[data-image-quality]")?.value || DEFAULT_QUALITY),
    webp: container.querySelector("[data-image-webp]")?.checked ?? true
  };
}

function reorderImages(state, draggedId, targetId) {
  if (draggedId === targetId) {
    return;
  }

  const draggedIndex = state.images.findIndex((image) => image.id === draggedId);
  const targetIndex = state.images.findIndex((image) => image.id === targetId);

  if (draggedIndex < 0 || targetIndex < 0) {
    return;
  }

  const images = [...state.images];
  const [draggedImage] = images.splice(draggedIndex, 1);
  images.splice(targetIndex, 0, draggedImage);
  state.images = images;
}

function getImage(state, imageId) {
  return state.images.find((image) => image.id === imageId);
}

function getProcessedName(name, type) {
  const baseName = name.replace(/\.[^.]+$/, "");
  const extension = type === "image/webp" ? "webp" : type.split("/")[1] || "jpg";
  return `${baseName}.${extension}`;
}

function formatFileSize(size) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanupImageManager(state) {
  state.destroyed = true;
  state.images.forEach((image) => {
    if (image.src) {
      URL.revokeObjectURL(image.src);
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
