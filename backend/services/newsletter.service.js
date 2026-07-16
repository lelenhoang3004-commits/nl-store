/**
 * Newsletter service.
 * It owns subscribe, unsubscribe, resubscribe, email normalization, and pagination behavior.
 */
import { NewsletterRepository } from "../repositories/newsletter.repository.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { createPaginationMeta, parseQueryOptions } from "../utils/query-options.util.js";

const NEWSLETTER_STATUS = Object.freeze({
  SUBSCRIBED: "subscribed",
  UNSUBSCRIBED: "unsubscribed"
});

const NEWSLETTER_QUERY_OPTIONS = Object.freeze({
  allowedSortFields: ["createdAt", "updatedAt", "email", "fullName", "source", "status", "subscribedAt", "unsubscribedAt"],
  allowedFilterFields: ["status", "source"]
});

export class NewsletterService extends BaseService {
  constructor(repository = new NewsletterRepository()) {
    super(repository);
  }

  async getSubscribers(query) {
    const options = parseQueryOptions(query, NEWSLETTER_QUERY_OPTIONS);
    const [subscribers, totalItems] = await Promise.all([
      this.repository.findAll(options),
      this.repository.countAll(options)
    ]);

    return {
      subscribers: subscribers.map((subscriber) => subscriber.toJSON()),
      meta: {
        pagination: createPaginationMeta(options.pagination, totalItems),
        search: options.search,
        sort: options.sort,
        filter: options.filter
      }
    };
  }

  async getSubscriberById(id) {
    const subscriber = await this.repository.findById(id);

    if (!subscriber) {
      throw new AppError("Newsletter subscriber was not found.", 404, "NEWSLETTER_SUBSCRIBER_NOT_FOUND");
    }

    return subscriber.toJSON();
  }

  async subscribe(payload) {
    const normalizedPayload = this.normalizePayload(payload);
    const existingSubscriber = await this.repository.findByEmail(normalizedPayload.email);

    if (!existingSubscriber) {
      const subscriber = await this.repository.create(normalizedPayload);
      return { ...subscriber.toJSON(), alreadySubscribed: false };
    }

    if (existingSubscriber.status === NEWSLETTER_STATUS.SUBSCRIBED) {
      return { ...existingSubscriber.toJSON(), alreadySubscribed: true };
    }

    const subscriber = await this.repository.resubscribe(existingSubscriber.id, normalizedPayload);
    return { ...subscriber.toJSON(), alreadySubscribed: false };
  }

  async unsubscribeByEmail(email) {
    const subscriber = await this.repository.findByEmail(normalizeEmail(email));

    if (!subscriber) {
      throw new AppError("Newsletter subscriber was not found.", 404, "NEWSLETTER_SUBSCRIBER_NOT_FOUND");
    }

    return this.unsubscribeSubscriber(subscriber);
  }

  async unsubscribeByToken(token) {
    const subscriber = await this.repository.findByUnsubscribeToken(token);

    if (!subscriber) {
      throw new AppError("Unsubscribe token is invalid.", 404, "NEWSLETTER_TOKEN_NOT_FOUND");
    }

    return this.unsubscribeSubscriber(subscriber);
  }

  async unsubscribeSubscriber(subscriber) {
    if (subscriber.status === NEWSLETTER_STATUS.UNSUBSCRIBED) {
      return subscriber.toJSON();
    }

    const updatedSubscriber = await this.repository.unsubscribe(subscriber.id);
    return updatedSubscriber.toJSON();
  }

  async updateSubscriberStatus(id, status) {
    await this.getSubscriberById(id);
    const normalizedStatus = String(status || "").trim().toLowerCase();
    if (!Object.values(NEWSLETTER_STATUS).includes(normalizedStatus)) {
      throw new AppError("Newsletter status is invalid.", 422, "INVALID_NEWSLETTER_STATUS");
    }
    const subscriber = await this.repository.updateStatus(id, normalizedStatus);
    return subscriber.toJSON();
  }

  async deleteSubscriber(id) {
    await this.getSubscriberById(id);
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new AppError("Newsletter subscriber could not be deleted.", 409, "NEWSLETTER_DELETE_FAILED");
    return { id, deleted: true };
  }
  normalizePayload(payload = {}) {
    const source = String(payload.source || "website").trim() || "website";
    return {
      email: normalizeEmail(payload.email),
      fullName: (payload.fullName ?? payload.full_name) ? String(payload.fullName ?? payload.full_name).trim() : null,
      source,
      status: NEWSLETTER_STATUS.SUBSCRIBED
    };
  }
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export { NEWSLETTER_STATUS };



