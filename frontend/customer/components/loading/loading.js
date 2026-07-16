/* Global Loading System
   Exports:
     - createSpinner(opts)
     - showOverlay(opts), hideOverlay()
     - showTopLoadingBar(), setTopLoadingProgress(pct), hideTopLoadingBar()
     - setButtonLoading(button|selector, loading)
     - showSectionLoading(root, opts), hideSectionLoading(root)
     - showPageLoading(opts), hidePageLoading()
     - initLoading(root)
*/

const IDS = {
  overlay: 'global-loading-overlay',
  topbar: 'global-loading-topbar'
};

export function createSpinner({ size = 40, color = 'var(--color-primary, #3b82f6)', className = '' } = {}) {
  const style = `width:${size}px;height:${size}px;`; 
  return `<span class="loading-spinner ${className}" style="${style} --spinner-color: ${color};" aria-hidden="true"></span>`;
}

function ensureBody() {
  if (!document.body) throw new Error('document.body not ready');
}

export function showOverlay({ message = '', dismissible = false, withSpinner = true } = {}) {
  ensureBody();
  let el = document.getElementById(IDS.overlay);
  if (!el) {
    el = document.createElement('div');
    el.id = IDS.overlay;
    el.className = 'global-loading-overlay';
    el.innerHTML = `<div class="global-loading-inner">${withSpinner ? createSpinner({ size:48 }) : ''}<div class="global-loading-message"></div></div>`;
    document.body.appendChild(el);
    if (dismissible) {
      el.addEventListener('click', hideOverlay);
    }
  }
  const msgEl = el.querySelector('.global-loading-message');
  if (msgEl) msgEl.textContent = message || '';
  el.classList.add('visible');
}

export function hideOverlay() {
  const el = document.getElementById(IDS.overlay);
  if (el) el.classList.remove('visible');
}

export function showTopLoadingBar() {
  ensureBody();
  let bar = document.getElementById(IDS.topbar);
  if (!bar) {
    bar = document.createElement('div');
    bar.id = IDS.topbar;
    bar.className = 'global-top-loading-bar';
    bar.innerHTML = `<div class="global-top-loading-indicator" style="width:0%"></div>`;
    document.body.appendChild(bar);
  }
  bar.classList.add('visible');
  setTopLoadingProgress(4); // small start
}

export function setTopLoadingProgress(pct = 0) {
  const bar = document.getElementById(IDS.topbar);
  if (!bar) return;
  const ind = bar.querySelector('.global-top-loading-indicator');
  if (!ind) return;
  const pctClamped = Math.max(0, Math.min(100, pct));
  ind.style.width = pctClamped + '%';
  if (pctClamped >= 100) {
    // complete animation
    setTimeout(() => { bar.classList.remove('visible'); ind.style.width = '0%'; }, 240);
  }
}

export function hideTopLoadingBar() { setTopLoadingProgress(100); }

export function setButtonLoading(btnOrSelector, loading = true) {
  const btn = typeof btnOrSelector === 'string' ? document.querySelector(btnOrSelector) : btnOrSelector;
  if (!btn) return;
  if (loading) {
    btn.classList.add('btn--loading');
    btn.setAttribute('aria-busy', 'true');
  } else {
    btn.classList.remove('btn--loading');
    btn.removeAttribute('aria-busy');
  }
}

export function showSectionLoading(root, { withOverlay = true, message = '', spinnerSize = 36 } = {}) {
  const el = typeof root === 'string' ? document.querySelector(root) : root;
  if (!el) return;
  let overlay = el.querySelector('.section-loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'section-loading-overlay';
    overlay.innerHTML = `<div class="section-loading-inner">${createSpinner({ size: spinnerSize })}<div class="section-loading-message">${message || ''}</div></div>`;
    el.style.position = el.style.position || (getComputedStyle(el).position === 'static' ? 'relative' : el.style.position);
    el.appendChild(overlay);
  }
  overlay.classList.add('visible');
}

export function hideSectionLoading(root) {
  const el = typeof root === 'string' ? document.querySelector(root) : root;
  if (!el) return;
  const overlay = el.querySelector('.section-loading-overlay');
  if (overlay) overlay.classList.remove('visible');
}

export function showPageLoading({ withTopBar = true, withOverlay = false, message = '' } = {}) {
  if (withTopBar) showTopLoadingBar();
  if (withOverlay) showOverlay({ message, withSpinner: true });
}

export function hidePageLoading() { hideTopLoadingBar(); hideOverlay(); }

export function initLoading(root = document) {
  // ensure topbar exists but hidden
  if (!document.getElementById(IDS.topbar)) {
    const bar = document.createElement('div');
    bar.id = IDS.topbar;
    bar.className = 'global-top-loading-bar';
    bar.innerHTML = `<div class="global-top-loading-indicator" style="width:0%"></div>`;
    document.body.appendChild(bar);
  }
  // ensure overlay exists but hidden
  if (!document.getElementById(IDS.overlay)) {
    const ov = document.createElement('div');
    ov.id = IDS.overlay;
    ov.className = 'global-loading-overlay';
    ov.innerHTML = `<div class="global-loading-inner">${createSpinner({ size:48 })}<div class="global-loading-message"></div></div>`;
    document.body.appendChild(ov);
  }
}
