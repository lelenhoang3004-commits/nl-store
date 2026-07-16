/* Vanilla Carousel Component
   Features: autoplay, loop, swipe/drag, navigation, indicators, responsive, lazy loading, infinite, animation
   Usage:
     - HTML: <div class="carousel" data-carousel> <div class="carousel-track"> <div class="carousel-slide">...</div> </div> </div>
     - Call initCarousel(root, options)
   Exports:
     - initCarousel(root, options)
     - Carousel class (for advanced use)
*/

function $$(sel, ctx=document) { return Array.from((ctx||document).querySelectorAll(sel)); }

class Carousel {
  constructor(root, opts={}) {
    this.root = typeof root === 'string' ? document.querySelector(root) : root;
    if (!this.root) throw new Error('Carousel root not found');
    this.track = this.root.querySelector('.carousel-track');
    this.slides = $$('.carousel-slide', this.root);
    this.options = Object.assign({
      perPage: 1,
      gap: 12,
      autoplay: false,
      interval: 4000,
      loop: true,
      draggable: true,
      indicators: true,
      navigation: true,
      lazy: true,
      animation: 'slide', // slide | fade
      breakpoints: { 640: 1, 900: 2, 1200: 3 }
    }, opts || {});

    this.current = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragDiff = 0;
    this.timer = null;
    this.clones = [];

    this._setup();
    this._bind();
    if (this.options.autoplay) this.play();
  }

  _setup() {
    this.root.classList.add('carousel--js');
    this._updatePerPage();
    this._createClones();
    this._applySizes();
    if (this.options.navigation) this._renderNav();
    if (this.options.indicators) this._renderIndicators();
    if (this.options.lazy) this._initLazy();
    this.goTo(this.current, false);
  }

  _updatePerPage() {
    const w = window.innerWidth;
    let pp = this.options.perPage || 1;
    const bps = this.options.breakpoints || {};
    Object.keys(bps).map(k=>parseInt(k)).sort((a,b)=>a-b).forEach(bp=>{ if (w >= bp) pp = bps[bp]; });
    this.perPage = Math.max(1, pp);
  }

  _createClones() {
    if (!this.options.loop) return;
    // remove existing clones
    this.clones.forEach(c=>c.remove()); this.clones = [];
    const count = this.perPage;
    const slides = this.slides;
    // prepend clones of last n
    for (let i = slides.length - count; i < slides.length; i++) {
      const clone = slides[i].cloneNode(true); clone.classList.add('carousel-clone'); this.track.insertBefore(clone, this.track.firstChild); this.clones.push(clone);
    }
    // append clones of first n
    for (let i = 0; i < count; i++) {
      const clone = slides[i].cloneNode(true); clone.classList.add('carousel-clone'); this.track.appendChild(clone); this.clones.push(clone);
    }
    // refresh slides list
    this.slides = $$('.carousel-slide', this.root);
  }

  _applySizes() {
    const total = this.slides.length;
    const gap = this.options.gap || 0;
    this.slideWidth = (this.track.clientWidth - gap * (this.perPage -1)) / this.perPage;
    this.slides.forEach(s => { s.style.width = `${this.slideWidth}px`; s.style.marginRight = `${gap}px`; });
    // remove margin on last visible
    if (this.slides.length) this.slides[this.slides.length-1].style.marginRight = '0px';
  }

  _renderNav() {
    if (this.root.querySelector('.carousel-nav')) return;
    const nav = document.createElement('div'); nav.className = 'carousel-nav';
    nav.innerHTML = `<button class="carousel-prev" aria-label="Trước">‹</button><button class="carousel-next" aria-label="Tiếp">›</button>`;
    this.root.appendChild(nav);
    this.prevBtn = nav.querySelector('.carousel-prev'); this.nextBtn = nav.querySelector('.carousel-next');
    this.prevBtn.addEventListener('click', ()=>this.prev()); this.nextBtn.addEventListener('click', ()=>this.next());
  }

  _renderIndicators() {
    if (this.root.querySelector('.carousel-indicators')) return;
    const wrap = document.createElement('div'); wrap.className = 'carousel-indicators';
    const pages = Math.max(1, Math.ceil((this.slides.length - (this.options.loop? this.perPage*2:0)) / this.perPage));
    wrap.innerHTML = Array.from({length: pages}).map((_,i)=>`<button class="carousel-ind" data-index="${i}" aria-label="Đi tới slide ${i+1}"></button>`).join('');
    this.root.appendChild(wrap);
    this.indicators = $$('.carousel-ind', wrap);
    this.indicators.forEach(btn => btn.addEventListener('click', (e)=>{ this.goTo(parseInt(btn.getAttribute('data-index')) * this.perPage); }));
  }

  _initLazy() {
    // images with data-src
    const imgs = $$('img[data-src]', this.root);
    const io = new IntersectionObserver(entries => { entries.forEach(ent => { if (ent.isIntersecting) { const img = ent.target; img.src = img.dataset.src; img.removeAttribute('data-src'); io.unobserve(img); } }); }, { root: this.track, threshold: 0.1 });
    imgs.forEach(i=>io.observe(i));
  }

  _bind() {
    window.addEventListener('resize', ()=>{ this._updatePerPage(); this._createClones(); this._applySizes(); this.goTo(this.current, false); });
    if (this.options.draggable) this._bindDrag();
    // keyboard
    this.root.addEventListener('keydown', (e)=>{ if (e.key === 'ArrowLeft') this.prev(); if (e.key === 'ArrowRight') this.next(); });
  }

  _bindDrag() {
    const onDown = (e) => { this.isDragging = true; this.root.classList.add('is-dragging'); this.dragStartX = e.clientX || (e.touches && e.touches[0].clientX); this.dragDiff = 0; if (this.options.autoplay) this.pause(); };
    const onMove = (e) => { if (!this.isDragging) return; const x = e.clientX || (e.touches && e.touches[0].clientX); this.dragDiff = x - this.dragStartX; this.track.style.transform = `translateX(${ - (this.current + (this.options.loop? this.perPage:0)) * (this.slideWidth + this.options.gap) + this.dragDiff }px)`; };
    const onUp = (e) => { if (!this.isDragging) return; this.isDragging = false; this.root.classList.remove('is-dragging'); const threshold = Math.max(20, this.slideWidth * 0.15); if (this.dragDiff > threshold) this.prev(); else if (this.dragDiff < -threshold) this.next(); else this.goTo(this.current); if (this.options.autoplay) this.play(); };
    this.track.addEventListener('pointerdown', (e)=>{ this.track.setPointerCapture && this.track.setPointerCapture(e.pointerId); onDown(e); });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // touch support fallback
    this.track.addEventListener('touchstart', onDown, { passive:true });
    this.track.addEventListener('touchmove', onMove, { passive:true });
    this.track.addEventListener('touchend', onUp);
  }

  _getTrackOffsetFor(index) {
    // account for clones when looping
    const offsetIndex = index + (this.options.loop ? this.perPage : 0);
    return - offsetIndex * (this.slideWidth + this.options.gap);
  }

  goTo(index = 0, animate = true) {
    // clamp
    const maxIndex = Math.max(0, this.slides.length - (this.options.loop? this.perPage*2: this.perPage));
    if (!this.options.loop) index = Math.max(0, Math.min(index, (this.slides.length - this.perPage)));
    this.current = index;
    const offset = this._getTrackOffsetFor(index);
    if (animate) { this.track.style.transition = 'transform 360ms cubic-bezier(.2,.9,.2,1)'; } else { this.track.style.transition = 'none'; }
    this.track.style.transform = `translateX(${offset}px)`;
    // update indicators
    this._updateIndicators();
    // lazy load images in view
    if (this.options.lazy) this._lazyLoadInView();
    // if loop and we moved into clones, reset without animation
    if (this.options.loop) {
      const visibleCount = this.slides.length - this.perPage*2;
      if (index < 0) {
        setTimeout(()=>{ this.track.style.transition = 'none'; this.current = visibleCount - this.perPage; this.track.style.transform = `translateX(${this._getTrackOffsetFor(this.current)}px)`; }, 380);
      } else if (index >= visibleCount) {
        setTimeout(()=>{ this.track.style.transition = 'none'; this.current = 0; this.track.style.transform = `translateX(${this._getTrackOffsetFor(this.current)}px)`; }, 380);
      }
    }
  }

  _updateIndicators() {
    if (!this.indicators) return;
    const page = Math.floor(this.current / this.perPage) % Math.max(1, this.indicators.length);
    this.indicators.forEach((b,i)=> b.classList.toggle('active', i===page));
  }

  _lazyLoadInView() {
    const start = this.current + (this.options.loop ? this.perPage : 0);
    const end = start + this.perPage;
    for (let i = start; i < end; i++) {
      const s = this.slides[i]; if (!s) continue; const imgs = $('img[data-src]', s) || s.querySelectorAll('img[data-src]'); imgs && imgs.forEach && imgs.forEach(img => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
    }
  }

  next() { this.goTo(this.current + this.perPage); }
  prev() { this.goTo(this.current - this.perPage); }

  play() { if (this.timer) return; this.timer = setInterval(()=> this.next(), this.options.interval); }
  pause() { if (!this.timer) return; clearInterval(this.timer); this.timer = null; }

  destroy() { this.pause(); window.removeEventListener('resize', this._resizeHandler); /* further cleanup omitted for brevity */ }
}

// helper to select single
function $(sel, ctx=document) { return (ctx||document).querySelector(sel); }

export function initCarousel(root = document, opts = {}) {
  const nodes = root === document ? $$('.carousel') : $$('.carousel', root);
  const instances = nodes.map(n => new Carousel(n, opts));
  return instances.length === 1 ? instances[0] : instances;
}
