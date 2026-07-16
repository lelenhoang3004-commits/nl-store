/* Empty State Component
   Exports:
     - createEmptyState(options) -> HTML string
     - initEmptyStates(root) -> attach entrance animations and optional action wiring

   options: {
     type: 'no-data'|'not-found'|'no-wishlist'|'no-cart'|'no-order'|'no-search'|string,
     title, message, icon (HTML), actions: [{ label, attrs, html }], size, animate
   }
*/

function defaultIconFor(type) {
  switch ((type||'').toLowerCase()) {
    case 'not-found': return '<i class="fa-regular fa-circle-xmark fa-3x"></i>';
    case 'no-wishlist': return '<i class="fa-regular fa-heart fa-3x"></i>';
    case 'no-cart': return '<i class="fa-solid fa-cart-shopping fa-3x"></i>';
    case 'no-order': return '<i class="fa-regular fa-file-lines fa-3x"></i>';
    case 'no-search': return '<i class="fa-solid fa-magnifying-glass fa-3x"></i>';
    default: return '<i class="fa-regular fa-folder-open fa-3x"></i>';
  }
}

function buildAttrs(attrs = {}) {
  return Object.entries(attrs).map(([k,v]) => `${k}="${v}"`).join(' ');
}

export function createEmptyState(options = {}) {
  const {
    type = 'no-data',
    title = '',
    message = '',
    icon = '',
    actions = [],
    size = 'md', // sm, md, lg
    animate = 'pop', // pop, fade, float, none
    attrs = {}
  } = options;

  const iconHtml = icon || defaultIconFor(type);
  const titleText = title || ({ 'no-data':'Chưa có dữ liệu', 'not-found':'Không tìm thấy', 'no-wishlist':'Danh sách yêu thích trống', 'no-cart':'Giỏ hàng của bạn đang trống', 'no-order':'Chưa có đơn hàng nào', 'no-search':'Không có kết quả' }[type] || 'Chưa có nội dung');
  const messageText = message || '';

  const classes = ['empty-state', `empty-state--${size}`];
  if (animate && animate !== 'none') classes.push(`empty-state--anim-${animate}`);

  const actionsHtml = (actions || []).map(a => (a.html ? a.html : `<button class="empty-action" ${buildAttrs(a.attrs||{})}>${a.label}</button>`)).join('');

  return `
    <div class="${classes.join(' ')}" data-empty-type="${type}" ${buildAttrs(attrs)}>
      <div class="empty-state-inner">
        <div class="empty-icon">${iconHtml}</div>
        <h3 class="empty-title">${titleText}</h3>
        ${messageText ? `<p class="empty-message">${messageText}</p>` : ''}
        ${actionsHtml ? `<div class="empty-actions">${actionsHtml}</div>` : ''}
      </div>
    </div>
  `;
}

export function initEmptyStates(root = document) {
  const scope = root || document;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('empty-state--visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  scope.querySelectorAll('.empty-state').forEach(el => {
    if (el.__emptyInit) return (el.__emptyInit = true);
    io.observe(el);
  });
}
