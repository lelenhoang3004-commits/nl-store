export function createMainContent() {
  return `
    <section class="content-hero" aria-labelledby="content-title">
      <div>
        <p class="content-eyebrow">Admin Layout</p>
        <h1 id="content-title">Khu vực nội dung chính</h1>
        <p class="content-description">
          Đây là vùng hiển thị nội dung cho từng trang quản trị. Các module như sản phẩm, danh mục,
          người dùng hoặc đơn hàng sẽ được gắn vào đây ở bước tiếp theo.
        </p>
      </div>
      <div class="content-status" aria-label="Layout status">
        <span class="status-dot"></span>
        Layout ready
      </div>
    </section>

    <section class="content-grid" aria-label="Layout placeholders">
      <article class="layout-panel">
        <i class="fa-solid fa-layer-group" aria-hidden="true"></i>
        <h2>Component Based</h2>
        <p>Sidebar, Header, Footer và Main Content được tách riêng để tái sử dụng.</p>
      </article>
      <article class="layout-panel">
        <i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>
        <h2>Responsive</h2>
        <p>Desktop dùng sidebar cố định, mobile chuyển thành drawer có overlay.</p>
      </article>
      <article class="layout-panel">
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        <h2>Modern UI</h2>
        <p>Thiết kế theo Material Design 3, Apple style, shadow mềm và bo góc 16px.</p>
      </article>
    </section>
  `;
}
