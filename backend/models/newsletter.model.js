/**
 * Newsletter subscriber model.
 * It maps newsletter subscriber rows to API-safe objects.
 */
import { BaseModel } from "./base.model.js";

export class NewsletterSubscriber extends BaseModel {
  constructor(attributes = {}) {
    super();
    this.id = attributes.id;
    this.email = attributes.email;
    this.fullName = attributes.fullName || attributes.full_name || "";
    this.source = attributes.source || "website";
    this.status = attributes.status;
    this.unsubscribeToken = attributes.unsubscribeToken || attributes.unsubscribe_token || null;
    this.subscribedAt = attributes.subscribedAt || attributes.subscribed_at || null;
    this.unsubscribedAt = attributes.unsubscribedAt || attributes.unsubscribed_at || null;
    this.createdAt = attributes.createdAt || attributes.created_at || null;
    this.updatedAt = attributes.updatedAt || attributes.updated_at || null;
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      fullName: this.fullName,
      source: this.source,
      status: this.status,
      unsubscribeToken: this.unsubscribeToken,
      subscribedAt: this.subscribedAt,
      unsubscribedAt: this.unsubscribedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
