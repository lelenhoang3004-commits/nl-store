const THEME_STORAGE_KEY = "fashion-admin-theme";
const THEME_MODES = {
  light: {
    label: "Light Mode",
    icon: "fa-sun"
  },
  dark: {
    label: "Dark Mode",
    icon: "fa-moon"
  },
  system: {
    label: "Auto System",
    icon: "fa-display"
  }
};

let systemThemeQuery = null;
let themeManagerInitialized = false;

export function initThemeManager() {
  if (themeManagerInitialized) {
    applyTheme(getStoredThemeMode());
    return;
  }

  systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  systemThemeQuery.addEventListener("change", handleSystemThemeChange);
  themeManagerInitialized = true;
  applyTheme(getStoredThemeMode());
}

export function toggleThemeManager(anchorButton) {
  const existingPanel = document.querySelector("[data-theme-manager]");

  if (existingPanel) {
    closeThemeManager();
    return;
  }

  const panel = document.createElement("div");
  panel.className = "theme-manager-panel";
  panel.dataset.themeManager = "";
  panel.innerHTML = createThemeManagerTemplate(getStoredThemeMode());

  document.body.appendChild(panel);
  positionThemePanel(panel, anchorButton);
  bindThemePanelEvents(panel);

  requestAnimationFrame(() => {
    panel.classList.add("is-open");
  });
}

export function closeThemeManager() {
  const panel = document.querySelector("[data-theme-manager]");

  if (!panel) {
    return;
  }

  panel.classList.remove("is-open");

  window.setTimeout(() => {
    panel.remove();
  }, 160);
}

export function isThemeManagerElement(target) {
  return Boolean(target.closest("[data-theme-manager]"));
}

export function applyTheme(mode) {
  const normalizedMode = THEME_MODES[mode] ? mode : "system";
  const effectiveMode = getEffectiveThemeMode(normalizedMode);

  localStorage.setItem(THEME_STORAGE_KEY, normalizedMode);
  document.body.classList.toggle("theme-dark", effectiveMode === "dark");
  document.body.dataset.themeMode = normalizedMode;
  document.documentElement.style.colorScheme = effectiveMode;
  updateThemeButtons(normalizedMode);
}

export function getStoredThemeMode() {
  const storedMode = localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_MODES[storedMode] ? storedMode : "system";
}

function createThemeManagerTemplate(activeMode) {
  return `
    <div class="theme-manager-card" role="menu" aria-label="Theme manager">
      <div class="theme-manager-heading">
        <strong>Theme</strong>
        <span>Chọn giao diện hiển thị</span>
      </div>
      ${Object.entries(THEME_MODES).map(([mode, meta]) => `
        <button class="theme-option ${mode === activeMode ? "is-active" : ""}" type="button" data-theme-option="${mode}" role="menuitem">
          <i class="fa-solid ${meta.icon}" aria-hidden="true"></i>
          <span>${meta.label}</span>
          <i class="fa-solid fa-check theme-check" aria-hidden="true"></i>
        </button>
      `).join("")}
    </div>
  `;
}

function bindThemePanelEvents(panel) {
  panel.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.themeOption);
      closeThemeManager();
    });
  });
}

function positionThemePanel(panel, anchorButton) {
  const rect = anchorButton.getBoundingClientRect();
  const right = Math.max(12, window.innerWidth - rect.right);
  const top = Math.min(rect.bottom + 12, window.innerHeight - 210);

  panel.style.top = `${Math.max(12, top)}px`;
  panel.style.right = `${right}px`;
}

function updateThemeButtons(mode) {
  const meta = THEME_MODES[mode];

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const icon = button.querySelector("i");

    button.setAttribute("aria-label", `Theme: ${meta.label}`);
    button.setAttribute("title", meta.label);

    if (icon) {
      icon.className = `fa-solid ${meta.icon}`;
    }
  });
}

function getEffectiveThemeMode(mode) {
  if (mode === "system") {
    return systemThemeQuery?.matches ? "dark" : "light";
  }

  return mode;
}

function handleSystemThemeChange() {
  if (getStoredThemeMode() === "system") {
    applyTheme("system");
  }
}
