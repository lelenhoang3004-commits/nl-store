import { showPageLoading, hidePageLoading } from "../components/loading/loading.js";
import { openModal } from "../components/modal/modal.js";
import { toast } from "../components/toast/toast.js";
import { loadTemplate } from "../router/template-cache.js";
import { inventoryService } from "../services/inventory.service.js";

let inventoryRows = [];
let inventoryHistory = [];
let inventoryChart = [];

export async function createInventoryPage() {
  showPageLoading("Đang tải tồn kho...");

  try {
    const templateUrl = new URL("./index.html", import.meta.url);
    const [html, inventoryData] = await Promise.all([
      loadTemplate(templateUrl),
      inventoryService.getInventoryDashboard()
    ]);

    inventoryRows = inventoryData.rows;
    inventoryHistory = inventoryData.history;
    inventoryChart = inventoryData.chart;
    return html;
  } finally {
    hidePageLoading();
  }
}

export function initInventoryPage(root = document) {
  renderStats(root);
  renderChart(root);
  renderHistory(root);
  renderInventoryTable(root, inventoryRows);
  bindInventoryEvents(root);
  toast.info("Đã tải module Quản lý tồn kho bằng dữ liệu giả.");
}

function bindInventoryEvents(root) {
  root.querySelectorAll("[data-inventory-action]").forEach((button) => {
    button.addEventListener("click", () => openStockModal(button.dataset.inventoryAction));
  });

  root.querySelector("[data-inventory-filter]")?.addEventListener("change", (event) => {
    const value = event.target.value;
    const rows = value === "all" ? inventoryRows : inventoryRows.filter((row) => row.status === value);
    renderInventoryTable(root, rows);
  });
}

function renderStats(root) {
  setText(root, "totalStock", inventoryRows.reduce((total, row) => total + row.stock, 0));
  setText(root, "outOfStock", inventoryRows.filter((row) => row.status === "Hết hàng").length);
  setText(root, "lowStock", inventoryRows.filter((row) => row.status === "Sắp hết").length);
  setText(root, "skuCount", inventoryRows.length);
}

function renderChart(root) {
  const maxValue = Math.max(...inventoryChart.flatMap((item) => [item.stockIn, item.stockOut]), 1);
  const chart = root.querySelector("[data-inventory-chart]");

  if (!chart) {
    return;
  }

  chart.innerHTML = inventoryChart.map((item) => `
    <div class="inventory-chart-column">
      <div class="inventory-chart-bars">
        <div class="inventory-chart-bar is-in" title="Nhập ${item.stockIn}" style="--bar-height: ${(item.stockIn / maxValue) * 100}%;"></div>
        <div class="inventory-chart-bar is-out" title="Xuất ${item.stockOut}" style="--bar-height: ${(item.stockOut / maxValue) * 100}%;"></div>
      </div>
      <span>${item.label}</span>
    </div>
  `).join("");
}

function renderHistory(root) {
  const history = root.querySelector("[data-inventory-history]");

  if (!history) {
    return;
  }

  history.innerHTML = inventoryHistory.map((item) => `
    <article>
      <span>${item.time}</span>
      <strong>${item.type} ${formatQuantity(item.quantity)} - ${item.sku}</strong>
      <p>${item.note}</p>
    </article>
  `).join("");
}

function renderInventoryTable(root, rows) {
  const table = root.querySelector("[data-inventory-table]");

  if (!table) {
    return;
  }

  table.innerHTML = `
    <table class="inventory-table">
      <thead>
        <tr>
          <th>SKU</th>
          <th>Sản phẩm</th>
          <th>Variant</th>
          <th>Tồn kho</th>
          <th>Ngưỡng cảnh báo</th>
          <th>Đã bán</th>
          <th>Trạng thái</th>
          <th>Cập nhật</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td>${row.sku}</td>
            <td>${row.name}</td>
            <td>${row.variant}</td>
            <td><span class="inventory-stock-number">${row.stock}</span></td>
            <td>${row.threshold}</td>
            <td>${row.sold}</td>
            <td><span class="inventory-status ${getStatusClass(row.status)}">${row.status}</span></td>
            <td>${row.updatedAt}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function openStockModal(type) {
  const isStockIn = type === "stock-in";

  openModal({
    eyebrow: "Inventory",
    title: isStockIn ? "Nhập kho" : "Xuất kho",
    saveText: isStockIn ? "Xác nhận nhập" : "Xác nhận xuất",
    successMessage: isStockIn ? "Đã xác nhận nhập kho trên giao diện mẫu." : "Đã xác nhận xuất kho trên giao diện mẫu.",
    body: `
      <div class="modal-form-grid" data-validate-form>
        <div class="validation-summary" data-validation-summary></div>
        <label class="validation-field">
          <span>SKU</span>
          <select name="sku" data-label="SKU" data-validate="required">
            ${inventoryRows.map((row) => `<option>${row.sku}</option>`).join("")}
          </select>
        </label>
        <label class="validation-field">
          <span>Số lượng</span>
          <input type="number" name="quantity" placeholder="VD: 12" data-label="Số lượng" data-validate="required|number|min:1|max:9999">
        </label>
        <label class="validation-field">
          <span>Lý do</span>
          <input type="text" name="reason" placeholder="${isStockIn ? "Nhập từ nhà cung cấp" : "Xuất theo đơn hàng"}" data-label="Lý do" data-validate="required|min:3|max:120">
        </label>
      </div>
    `
  });
}

function setText(root, key, value) {
  const element = root.querySelector(`[data-inventory-stat="${key}"]`);

  if (element) {
    element.textContent = new Intl.NumberFormat("vi-VN").format(value);
  }
}

function getStatusClass(status) {
  if (status === "Còn hàng") {
    return "is-success";
  }

  if (status === "Sắp hết") {
    return "is-warning";
  }

  return "is-danger";
}

function formatQuantity(quantity) {
  return quantity > 0 ? `+${quantity}` : String(quantity);
}
