const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function activateModalUX(overlay, { onClose, initialFocus } = {}) {
  const previouslyFocused = document.activeElement;
  const dialog = overlay.querySelector('[role="dialog"]');

  function handleKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = [...overlay.querySelectorAll(FOCUSABLE)].filter((element) => element.offsetParent !== null);
    if (!elements.length) {
      event.preventDefault();
      dialog?.focus();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", handleKeydown);
  requestAnimationFrame(() => {
    const target = typeof initialFocus === "string" ? overlay.querySelector(initialFocus) : initialFocus;
    (target || dialog)?.focus({ preventScroll: true });
  });

  return () => {
    document.removeEventListener("keydown", handleKeydown);
    if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus({ preventScroll: true });
  };
}
