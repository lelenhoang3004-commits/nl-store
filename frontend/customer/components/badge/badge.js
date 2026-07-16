/* Badge System
   Exports:
     - createBadge(options) -> HTML string
     - createBadgeGroup(items) -> HTML string
     - initBadges(root) -> attach animations / visibility observer

   options: { text, variant, size, pill, rounded, color, inverted, attrs, animate }
*/

function normalizeVariant(v) {
  if (!v) return 'default';
  return v.toString().toLowerCase().replace(/\s+/g, '-');
}

function ensureColorContrast(hex) {
  // returns either '#000' or '#fff' for best contrast against background hex
  if (!hex) return '#fff';
  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0,2),16);
  const g = parseInt(c.substr(2,2),16);
  const b = parseInt(c.substr(4,2),16);
  // luminance
  const lum = 0.2126*r + 0.7152*g + 0.0722*b;
  return lum > 180 ? '#000' : '#fff';
}

export function createBadge(options = {}) {
  const {
    text = '',
    variant = 'default',
    size = 'md', // xs, sm, md, lg
    pill = false,
    rounded = true,
    color = '', // custom hex or css color
    inverted = false,
    animate = 'pop', // pop, pulse, slide, none
    attrs = {}
  } = options;

  const v = normalizeVariant(variant);
  const classes = ['badge', `badge--${v}`, `badge--${size}`];
  if (pill) classes.push('badge--pill');
  if (rounded) classes.push('badge--rounded');
  if (inverted) classes.push('badge--inverted');
  if (animate && animate !== 'none') classes.push(`badge--anim-${animate}`);

  let style = '';
  if (color) {
    const contrast = ensureColorContrast(color);
    style = `style="--badge-bg: ${color}; --badge-color: ${contrast};"`;
  }

  const attrString = Object.entries(attrs || {}).map(([k,v]) => `${k}="${v}"`).join(' ');

  return `<span class="${classes.join(' ')}" ${style} ${attrString}>${text}</span>`;
}

export function createBadgeGroup(items = []) {
  const content = items.map(it => typeof it === 'string' ? it : createBadge(it)).join(' ');
  return `<div class="badge-group">${content}</div>`;
}

export function initBadges(root = document) {
  const scope = root || document;

  // Animate badges when they enter viewport (if they have anim classes)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('badge--visible');
      observer.unobserve(el);
    });
  }, { threshold: 0.2 });

  scope.querySelectorAll('.badge').forEach(b => {
    // avoid re-attaching
    if (b.__badgeInit) return (b.__badgeInit = true);
    if (b.classList.contains('badge--anim-pop') || b.classList.contains('badge--anim-slide') || b.classList.contains('badge--anim-pulse')) {
      observer.observe(b);
    }
  });
}
