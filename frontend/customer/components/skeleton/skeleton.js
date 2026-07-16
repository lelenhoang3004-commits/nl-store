/* Shared Skeleton System
   Exports:
     - createSkeleton(type, options)
     - createSkeletonGrid(count, cols, options)
     - createSkeletonCard(options)
     - createSkeletonImage(options)
     - createSkeletonText(options)
     - createSkeletonAvatar(options)
     - createSkeletonBanner(options)
     - createSkeletonDetail(options)
     - initSkeletons(root)

   Types: 'card', 'image', 'text', 'avatar', 'banner', 'detail', 'custom'
*/

function buildAttrs(attrs = {}) {
  return Object.entries(attrs).map(([k,v]) => `${k}="${v}"`).join(' ');
}

export function createSkeleton(type = 'card', options = {}) {
  const { size = 'md', lines = 3, width = '100%', height = '', shape = 'rect', className = '', attrs = {} } = options;

  const base = `skeleton skeleton--${type} skeleton--${size} ${className}`.trim();
  const style = [];
  if (width) style.push(`width: ${width};`);
  if (height) style.push(`height: ${height};`);

  const attrString = buildAttrs(attrs);
  return `<div class="${base}" style="${style.join(' ')}" ${attrString} data-skeleton-type="${type}">${Array.from({length: Math.max(1, lines)}).map((_,i)=>`<div class="skeleton-line" data-line-index="${i}"></div>`).join('')}</div>`;
}

export function createSkeletonGrid(count = 6, cols = 3, options = {}) {
  const items = Array.from({length: count}).map(()=>createSkeleton('card', options)).join('');
  return `<div class="skeleton-grid" style="grid-template-columns: repeat(${cols}, 1fr);">${items}</div>`;
}

export function createSkeletonCard(options = {}) {
  // default card: image + title + meta lines
  const img = `<div class="skeleton-box skeleton--image"></div>`;
  const lines = `<div class="skeleton-content">${createSkeleton('text', { lines: 2, size: 'sm' })}${createSkeleton('text', { lines:1, size: 'xs' })}</div>`;
  return `<div class="skeleton-card">${img}${lines}</div>`;
}

export function createSkeletonImage(options = {}) {
  const { width='100%', height='160px', shape='rect', className='', attrs={} } = options;
  return `<div class="skeleton skeleton--image ${className}" style="width:${width};height:${height};" ${buildAttrs(attrs)}></div>`;
}

export function createSkeletonText(options = {}) {
  const { lines = 3, size='md', className='', attrs={} } = options;
  return `<div class="skeleton skeleton--text skeleton--${size} ${className}" ${buildAttrs(attrs)}>${Array.from({length: Math.max(1,lines)}).map(()=>`<div class="skeleton-line"></div>`).join('')}</div>`;
}

export function createSkeletonAvatar(options = {}) {
  const { size='48px', className='', attrs={} } = options;
  return `<div class="skeleton skeleton--avatar ${className}" style="width:${size};height:${size};border-radius:50%;" ${buildAttrs(attrs)}></div>`;
}

export function createSkeletonBanner(options = {}) {
  const { height='200px', className='', attrs={} } = options;
  return `<div class="skeleton skeleton--banner ${className}" style="height:${height};" ${buildAttrs(attrs)}></div>`;
}

export function createSkeletonDetail(options = {}) {
  // detail page skeleton: banner + sidebar + content lines
  const banner = createSkeletonBanner({ height: options.bannerHeight || '260px' });
  const content = `<div class="skeleton-detail-body"><div class="skeleton-detail-main">${createSkeletonText({ lines: 6 })}</div><aside class="skeleton-detail-side">${createSkeleton('card')}${createSkeleton('card')}</aside></div>`;
  return `<div class="skeleton-detail">${banner}${content}</div>`;
}

export function initSkeletons(root = document) {
  const scope = root || document;
  // Start shimmer on visible skeletons. Use IntersectionObserver to reduce work.
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('skeleton--visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  scope.querySelectorAll('.skeleton').forEach(el => {
    if (el.__skeletonInit) return (el.__skeletonInit = true);
    io.observe(el);
  });
}
