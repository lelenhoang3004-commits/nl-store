import { AdminOrderRepository } from "../repositories/admin-order.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { createPaginationMeta, parsePagination } from "../utils/query-options.util.js";
import { withTransaction } from "../utils/database.util.js";
import { NotificationService } from "./notification.service.js";

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipping", "completed", "cancelled", "refunded"];
const TRANSITIONS = Object.freeze({
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipping"],
  shipping: ["completed"],
  completed: [],
  cancelled: [],
  refunded: []
});

export class AdminOrderService extends BaseService {
  constructor(repository = new AdminOrderRepository(), notificationService = new NotificationService()) {
    super(repository);
    this.notificationService = notificationService;
  }

  async listOrders(query = {}) {
    const options = normalizeListOptions(query);
    const [orders, totalItems] = await Promise.all([
      this.repository.findAll(options),
      this.repository.countAll(options)
    ]);
    return {
      orders: orders.map((order) => order.toJSON()),
      pagination: createPaginationMeta(options, totalItems)
    };
  }

  async getOrderDetail(orderId) {
    const order = await this.repository.findById(orderId);
    if (!order) throw new AppError("Order was not found.", 404, "ADMIN_ORDER_NOT_FOUND");
    const [items, payments, histories] = await Promise.all([
      this.repository.findItemsByOrderId(orderId),
      this.repository.findPaymentByOrderId(orderId),
      this.repository.findHistoriesByOrderId(orderId)
    ]);
    return {
      order: order.toJSON(),
      items: items.map((item) => item.toJSON()),
      payment: payments[0]?.toJSON() || null,
      payments: payments.map((payment) => payment.toJSON()),
      histories: histories.map((history) => history.toJSON())
    };
  }

  async updateOrderStatus(orderId, status, adminUser, note = null) {
    if (!ORDER_STATUSES.includes(status)) {
      throw new AppError("Order status is invalid.", 422, "INVALID_ORDER_STATUS");
    }
    await withTransaction(async (connection) => {
      const order = await this.repository.findById(orderId, connection, true);
      if (!order) throw new AppError("Order was not found.", 404, "ADMIN_ORDER_NOT_FOUND");
      const allowedStatuses = TRANSITIONS[order.status] || [];
      if (!allowedStatuses.includes(status)) {
        throw new AppError("Order status transition is not allowed.", 409, "ORDER_STATUS_TRANSITION_NOT_ALLOWED", {
          currentStatus: order.status,
          nextStatus: status,
          allowedStatuses
        });
      }
      if (status === "cancelled") {
        await this.cancelLockedOrder(order, note || "Order cancelled by administrator.", adminUser, connection);
        return;
      }
      await this.repository.updateStatus(orderId, status, connection);
      await this.repository.createOrderHistory({
        orderId: Number(orderId), status, note: note || `Admin changed order status to ${status}.`, changedBy: adminUser.id
      }, connection);
    });
    return this.getOrderDetail(orderId);
  }

  async cancelOrder(orderId, reason, adminUser) {
    await withTransaction(async (connection) => {
      const order = await this.repository.findById(orderId, connection, true);
      if (!order) throw new AppError("Order was not found.", 404, "ADMIN_ORDER_NOT_FOUND");
      if (!["pending", "confirmed"].includes(order.status)) {
        throw new AppError("This order can no longer be cancelled.", 409, "ORDER_CANNOT_BE_CANCELLED", {
          currentStatus: order.status
        });
      }
      await this.cancelLockedOrder(order, reason || "Order cancelled by administrator.", adminUser, connection);
    });
    return this.getOrderDetail(orderId);
  }

  async getOrderPayments(orderId) {
    const order = await this.repository.findById(orderId);
    if (!order) throw new AppError("Order was not found.", 404, "ADMIN_ORDER_NOT_FOUND");
    const payments = await this.repository.findPaymentByOrderId(orderId);
    return payments.map((payment) => payment.toJSON());
  }

  async cancelLockedOrder(order, reason, adminUser, connection) {
    const items = await this.repository.findItemsByOrderId(order.id, connection);
    await this.repository.restoreInventory(items, connection);
    await this.repository.updateCancelled(order.id, connection);
    await this.repository.createOrderHistory({
      orderId: order.id, status: "cancelled", note: reason, changedBy: adminUser.id
    }, connection);
    await this.notificationService.notifyAdmin({
      type: "ORDER_CANCELLED",
      title: "Đơn hàng bị hủy",
      message: `Đơn ${order.orderCode} đã bị hủy. Lý do: ${reason}`,
      link: "#orders",
      relatedId: order.id,
      eventKey: `order-cancelled:${order.id}`
    }, connection);
  }
}

function normalizeListOptions(query) {
  const pagination = parsePagination(query);
  return {
    ...pagination,
    search: String(query.search || "").trim(),
    status: query.status || null,
    paymentStatus: query.paymentStatus || null,
    paymentMethod: query.paymentMethod || null,
    dateFrom: query.dateFrom || null,
    dateTo: query.dateTo || null,
    sortBy: query.sortBy || "createdAt",
    sortDirection: String(query.sortDirection || query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc"
  };
}

export { ORDER_STATUSES, TRANSITIONS as ADMIN_ORDER_TRANSITIONS };




