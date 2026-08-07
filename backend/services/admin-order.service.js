import { AdminOrderRepository } from "../repositories/admin-order.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { createPaginationMeta, parsePagination } from "../utils/query-options.util.js";
import { withTransaction } from "../utils/database.util.js";
import { NotificationService } from "./notification.service.js";

const ORDER_STATUSES = ["pending", "confirmed", "processing", "shipping", "completed", "cancelled", "refunded"];
const ORDER_WORKFLOW = ["pending", "confirmed", "processing", "shipping", "completed"];
const TERMINAL_STATUSES = new Set(["completed", "cancelled", "refunded"]);
const TRANSITIONS = Object.freeze({
  pending: ["confirmed", "processing", "shipping", "completed", "cancelled"],
  confirmed: ["processing", "shipping", "completed", "cancelled"],
  processing: ["shipping", "completed"],
  shipping: ["completed"],
  completed: [],
  cancelled: [],
  refunded: []
});
const ORDER_STATUS_LABELS = Object.freeze({
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  processing: "Đang xử lý",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền"
});

export class AdminOrderService extends BaseService {
  constructor(repository = new AdminOrderRepository(), notificationService = new NotificationService(), transactionRunner = withTransaction) {
    super(repository);
    this.notificationService = notificationService;
    this.withTransaction = transactionRunner;
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
    await this.withTransaction(async (connection) => {
      const order = await this.repository.findById(orderId, connection, true);
      if (!order) throw new AppError("Order was not found.", 404, "ADMIN_ORDER_NOT_FOUND");
      const allowedStatuses = TRANSITIONS[order.status] || [];
      if (status === order.status) return;
      if (status === "cancelled") {
        throw new AppError("Use the order cancellation flow to cancel this order.", 409, "ORDER_CANCEL_REQUIRES_CANCEL_FLOW", {
          currentStatus: order.status
        });
      }
      if (TERMINAL_STATUSES.has(order.status)) {
        throw new AppError("Order status transition is not allowed.", 409, "ORDER_STATUS_TRANSITION_NOT_ALLOWED", {
          currentStatus: order.status,
          nextStatus: status,
          allowedStatuses
        });
      }
      const transitionSteps = getForwardTransitionSteps(order.status, status);
      if (!transitionSteps.length || !allowedStatuses.includes(status)) {
        throw new AppError("Order status transition is not allowed.", 409, "ORDER_STATUS_TRANSITION_NOT_ALLOWED", {
          currentStatus: order.status,
          nextStatus: status,
          allowedStatuses
        });
      }
      const targetLabel = orderStatusLabel(status);
      for (const stepStatus of transitionSteps) {
        await this.repository.updateStatus(orderId, stepStatus, connection);
        await this.repository.createOrderHistory({
          orderId: Number(orderId),
          status: stepStatus,
          note: buildStatusHistoryNote({ stepStatus, targetStatus: status, targetLabel, note }),
          changedBy: adminUser.id
        }, connection);
      }
    });
    return this.getOrderDetail(orderId);
  }

  async cancelOrder(orderId, reason, adminUser) {
    await this.withTransaction(async (connection) => {
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

function getForwardTransitionSteps(currentStatus, targetStatus) {
  const currentIndex = ORDER_WORKFLOW.indexOf(currentStatus);
  const targetIndex = ORDER_WORKFLOW.indexOf(targetStatus);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex <= currentIndex) return [];
  return ORDER_WORKFLOW.slice(currentIndex + 1, targetIndex + 1);
}

function buildStatusHistoryNote({ stepStatus, targetStatus, targetLabel, note }) {
  if (stepStatus !== targetStatus) {
    return `Tự động hoàn tất bước trung gian khi quản trị viên chọn ${targetLabel}.`;
  }
  return note || `Quản trị viên cập nhật trạng thái đơn hàng thành ${orderStatusLabel(stepStatus)}.`;
}

function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status;
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




