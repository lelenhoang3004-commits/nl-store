const inventoryRows = [
  { id: 1, sku: "FS-BLZ-001-BLK-M", name: "Linen Blazer nữ dáng rộng", variant: "Đen / M", stock: 42, threshold: 12, sold: 318, status: "Còn hàng", updatedAt: "06/07/2026 09:20" },
  { id: 2, sku: "FS-SHM-014-WHT-L", name: "Áo sơ mi Oxford nam", variant: "Trắng / L", stock: 86, threshold: 18, sold: 502, status: "Còn hàng", updatedAt: "06/07/2026 08:35" },
  { id: 3, sku: "FS-DRS-027-BGE-S", name: "Đầm midi satin", variant: "Be / S", stock: 18, threshold: 20, sold: 146, status: "Sắp hết", updatedAt: "05/07/2026 16:10" },
  { id: 4, sku: "FS-JEA-042-NVY-M", name: "Quần jeans straight fit", variant: "Navy / M", stock: 7, threshold: 15, sold: 271, status: "Sắp hết", updatedAt: "05/07/2026 14:45" },
  { id: 5, sku: "FS-BAG-009-CVS-OS", name: "Túi tote canvas premium", variant: "Canvas / OS", stock: 120, threshold: 25, sold: 689, status: "Còn hàng", updatedAt: "04/07/2026 11:00" },
  { id: 6, sku: "FS-JKT-016-DNM-M", name: "Áo khoác cropped denim", variant: "Denim / M", stock: 0, threshold: 10, sold: 98, status: "Hết hàng", updatedAt: "03/07/2026 17:30" },
  { id: 7, sku: "FS-SKT-021-BLK-S", name: "Chân váy pleated mini", variant: "Đen / S", stock: 35, threshold: 14, sold: 233, status: "Còn hàng", updatedAt: "02/07/2026 10:25" }
];

const inventoryHistory = [
  { id: 1, time: "06/07/2026 09:20", type: "Nhập kho", sku: "FS-BLZ-001-BLK-M", quantity: 24, note: "Nhập bổ sung từ nhà cung cấp" },
  { id: 2, time: "06/07/2026 08:35", type: "Xuất kho", sku: "FS-SHM-014-WHT-L", quantity: -8, note: "Đồng bộ đơn hàng storefront" },
  { id: 3, time: "05/07/2026 16:10", type: "Điều chỉnh", sku: "FS-DRS-027-BGE-S", quantity: -2, note: "Kiểm kê cuối ngày" },
  { id: 4, time: "05/07/2026 14:45", type: "Xuất kho", sku: "FS-JEA-042-NVY-M", quantity: -12, note: "Đơn hàng flash sale" },
  { id: 5, time: "04/07/2026 11:00", type: "Nhập kho", sku: "FS-BAG-009-CVS-OS", quantity: 60, note: "Nhập lô hàng mới" }
];

const chartData = [
  { label: "T2", stockIn: 32, stockOut: 18 },
  { label: "T3", stockIn: 44, stockOut: 27 },
  { label: "T4", stockIn: 26, stockOut: 34 },
  { label: "T5", stockIn: 58, stockOut: 31 },
  { label: "T6", stockIn: 38, stockOut: 42 },
  { label: "T7", stockIn: 64, stockOut: 29 },
  { label: "CN", stockIn: 22, stockOut: 36 }
];

export const inventoryService = {
  async getInventoryDashboard() {
    await wait(180);

    return {
      rows: inventoryRows.map((row) => ({ ...row })),
      history: inventoryHistory.map((item) => ({ ...item })),
      chart: chartData.map((item) => ({ ...item }))
    };
  }
};

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
