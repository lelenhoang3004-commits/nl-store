/*
  Button system helper
  Exports:
    - createButton(options) -> HTML string for a button
    - createButtonGroup(buttonsArray) -> HTML string for a button group
    - initButtons(root) -> wire ripples, loading toggles, keyboard focus styles
*/

export function createButton(options = {}) {
  const {
    id = "",
    type = "button",
    variant = "primary", // primary, secondary, outline, ghost, danger, success, warning, dark, light
    size = "md", // xs, sm, md, lg, xl
    label = "",
    title = "",
    icon = "", // optional HTML string for icon
    iconOnly = false,
    loading = false,
    disabled = false,
    fab = false,
    attrs = {}
  } = options;

  const classes = ["btn", `btn--${variant}`, `btn--${size}`];
  if (iconOnly) classes.push("btn--icon");
  if (loading) classes.push("btn--loading");
  if (disabled) classes.push("is-disabled");
  if (fab) classes.push("btn--fab");

  const attrString = Object.entries(attrs || {}).map(([k, v]) => `${k}="${v}"`).join(" ");

  return `
    <button ${id ? `id="${id}"` : ""} class="${classes.join(" ")}" type="${type}" ${disabled ? "disabled" : ""} title="${title || label}" ${attrString}>
      ${icon ? `<span class="btn-icon">${icon}</span>` : ""}
      ${label && !iconOnly ? `<span class="btn-label">${label}</span>` : ""}
    </button>
  `;
}

export function createIconButton(options = {}) {
  return createButton({ ...options, iconOnly: true });
}

export function createButtonGroup(buttons = []) {
  // buttons: array of HTML strings or objects { html }
  const items = buttons.map((b) => typeof b === "string" ? b : (b.html || createButton(b))).join("");
  return `<div class="btn-group" role="group">${items}</div>`;
}

export function initButtons(root = document) {
  const scope = root || document;

  // attach ripple
  scope.querySelectorAll(".btn:not(.btn--no-ripple)").forEach((btn) => {
    // avoid duplicate listeners
    if (btn.__rippleAttached) return (btn.__rippleAttached = true);

    btn.addEventListener("click", function (e) {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      ripple.className = "btn-ripple";
      const size = Math.max(rect.width, rect.height) * 1.2;
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      btn.appendChild(ripple);

      window.setTimeout(() => ripple.remove(), 600);
    });
  });

  // loading toggle helper: any button with data-loading-target will toggle aria-busy
  scope.querySelectorAll("[data-toggle-loading]").forEach((el) => {
    if (el.__loadingAttached) return (el.__loadingAttached = true);
    el.addEventListener("click", (e) => {
      const btn = el.closest(".btn") || el;
      btn.classList.add("btn--loading");
      btn.setAttribute("aria-busy", "true");
      // demo auto-clear after 1.5s
      setTimeout(() => {
        btn.classList.remove("btn--loading");
        btn.removeAttribute("aria-busy");
      }, 1500);
    });
  });

  // keyboard focus ring (polyfill): add class on focus-visible
  scope.addEventListener("keydown", () => document.documentElement.classList.add("user-is-tabbing"));
  scope.addEventListener("mousedown", () => document.documentElement.classList.remove("user-is-tabbing"));
}
