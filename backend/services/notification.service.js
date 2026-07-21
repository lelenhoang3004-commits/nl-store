import { NotificationRepository } from "../repositories/notification.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";

export class NotificationService extends BaseService {
  constructor(repository = new NotificationRepository()) {
    super(repository);
  }

  async listForUser(user, query = {}) {
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50);
    const offset = Math.max(Number(query.offset || 0), 0);
    const [items, unreadCount] = await Promise.all([
      this.repository.findForPrincipal(user, { limit, offset }),
      this.repository.countUnreadForPrincipal(user)
    ]);
    return { notifications: items, unreadCount };
  }

  async markRead(id, user) {
    const notificationId = Number(id);
    if (!Number.isInteger(notificationId) || notificationId < 1) {
      throw new AppError("Notification was not found.", 404, "NOTIFICATION_NOT_FOUND");
    }
    const updated = await this.repository.markRead(notificationId, user);
    if (!updated) throw new AppError("Notification was not found.", 404, "NOTIFICATION_NOT_FOUND");
    return { id: notificationId, read: true };
  }

  async markAllRead(user) {
    const updated = await this.repository.markAllRead(user);
    return { updated };
  }

  async notifyAdmin(payload, connection = null) {
    return this.repository.create({ ...payload, targetType: "role", role: "ADMIN" }, connection);
  }

  async notifyCustomer(userId, payload, connection = null) {
    if (!userId) return null;
    return this.repository.create({ ...payload, targetType: "user", userId }, connection);
  }

  async notifyRole(role, payload, connection = null) {
    return this.repository.create({ ...payload, targetType: "role", role: String(role || "").toUpperCase() }, connection);
  }
}
