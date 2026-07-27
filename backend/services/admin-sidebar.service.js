import { AUTH_PERMISSIONS, AUTH_ROLES } from "../config/auth.config.js";
import { AdminSidebarRepository } from "../repositories/admin-sidebar.repository.js";
import { BaseService } from "./base.service.js";

const COUNT_KEYS = Object.freeze({
  products_attention: [AUTH_PERMISSIONS.PRODUCT_VIEW],
  pending_orders: [AUTH_PERMISSIONS.ORDER_VIEW],
  pending_payments: [AUTH_PERMISSIONS.PAYMENT_VIEW],
  unread_newsletter: [AUTH_PERMISSIONS.NEWSLETTER_VIEW, AUTH_PERMISSIONS.EMAIL_VIEW]
});

export class AdminSidebarService extends BaseService {
  constructor(repository = new AdminSidebarRepository()) {
    super(repository);
  }

  async getCounts(user = {}) {
    const permissions = new Set(Array.isArray(user.permissions) ? user.permissions : []);
    const canSee = (key) => user.role === AUTH_ROLES.ADMIN || COUNT_KEYS[key].some((permission) => permissions.has(permission));
    const entries = await Promise.all([
      canSee("products_attention") ? this.repository.countProductsAttention() : 0,
      canSee("pending_orders") ? this.repository.countPendingOrders() : 0,
      canSee("pending_payments") ? this.repository.countPendingPayments() : 0,
      canSee("unread_newsletter") ? this.repository.countUnreadNewsletter() : 0
    ]);

    return {
      products_attention: entries[0],
      pending_orders: entries[1],
      pending_payments: entries[2],
      unread_newsletter: entries[3]
    };
  }
}
