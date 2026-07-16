/* Banner Component
   Exports:
     - createBanner(options) -> HTML
     - createCollectionBanner(items, options)
     - initBanners(root) -> attach entrance animations and CTA delegation

   options: {
     id, layout: 'horizontal'|'vertical'|'promotion'|'collection', image, imageAlt, title, subtitle,
     cta: { label, href, attrs }, items: [], height, aspectRatio, badge, animate
   }
*/

function buildAttrs(attrs = {}) { return Object.entries(attrs).map(([k,v])=>`${k}="${v}"`).join(' '); }

export function createBanner(options = {}) {
  const {
    id = '',
    layout = 'horizontal',
    image = '',
    imageAlt = '',
    title = '',
    subtitle = '',
    cta = null,
    height = '',
    aspectRatio = '',
    badge = '',
    animate = 'fade',
    attrs = {}
  } = options;

  const classes = ['banner', `banner--${layout}`];
  if (animate && animate !== 'none') classes.push(`banner--anim-${animate}`);

  const style = [];
  if (height) style.push(`height:${height};`);
  if (aspectRatio) style.push(`aspect-ratio:${aspectRatio};`);

  const idAttr = id ? `id="${id}"` : '';
  const attrString = buildAttrs(attrs);

  // layout markup
  let inner = '';
  if (layout === 'collection') {
    // items expected on options.items
    inner = (options.items||[]).map(it=>`<a class="banner-collection-item" href="${it.href||'#'}">${it.image?`<img src="${it.image}" alt="${it.alt||''}"/>`:''}<div class="banner-collection-meta"><strong>${it.title||''}</strong><small>${it.subtitle||''}</small></div></a>`).join('');
    return `<div ${idAttr} class="${classes.join(' ')}" style="${style.join(' ')}" ${attrString}><div class="banner-collection">${inner}</div></div>`;
  }

  // horizontal / vertical / promotion
  const imgHtml = image ? `<div class="banner-media"> <img src="${image}" alt="${imageAlt||''}"/> ${badge?`<span class="banner-badge">${badge}</span>`:''} </div>` : '';
  const contentHtml = `<div class="banner-content"><div class="banner-text"><h2 class="banner-title">${title}</h2>${subtitle?`<p class="banner-subtitle">${subtitle}</p>`:''}</div>${cta?`<div class="banner-cta"><a class="btn btn--primary" href="${cta.href||'#'}" ${buildAttrs(cta.attrs||{})}>${cta.label||'Xem'}</a></div>`:''}</div>`;

  if (layout === 'vertical') {
    inner = `<div class="banner-vertical">${imgHtml}<div class="banner-vertical-meta">${contentHtml}</div></div>`;
  } else if (layout === 'promotion') {
    inner = `<div class="banner-promo" style="${style.join(' ')}">${image?`<img src="${image}" alt="${imageAlt||''}"/>`:''}<div class="banner-promo-overlay">${contentHtml}</div></div>`;
  } else {
    inner = `<div class="banner-horizontal">${imgHtml}<div class="banner-horizontal-meta">${contentHtml}</div></div>`;
  }

  return `<section ${idAttr} class="${classes.join(' ')}" ${attrString}>${inner}</section>`;
}

export function createCollectionBanner(items = [], options = {}) { return createBanner({ ...options, layout: 'collection', items }); }

export function initBanners(root = document) {
  const scope = root || document;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('banner--visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });

  scope.querySelectorAll('.banner').forEach(b => { if (b.__bannerInit) return (b.__bannerInit = true); io.observe(b); });

  // delegate CTA clicks for data-action attributes
  scope.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-banner-action]');
    if (!a) return;
    const action = a.getAttribute('data-banner-action');
    const evt = new CustomEvent('banner:action', { detail: { action, el: a }, bubbles: true });
    a.dispatchEvent(evt);
  });
}
