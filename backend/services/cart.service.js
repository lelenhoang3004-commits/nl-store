/**
 * Cart service.
 * It validates product, stock, variants, size, and color before writing cart data.
 */
import { CartRepository } from "../repositories/cart.repository.js";
import { ProductVariantRepository } from "../repositories/product-variant.repository.js";
import { VoucherService } from "./voucher.service.js";
import { BaseService } from "./base.service.js";
import { AppError } from "../utils/app-error.util.js";
import { withTransaction } from "../utils/database.util.js";
import crypto from "node:crypto";

export class CartService extends BaseService {
  constructor(repository = new CartRepository(), variantRepository = new ProductVariantRepository(), voucherService = new VoucherService()) {
    super(repository);
    this.variantRepository = variantRepository;
    this.voucherService = voucherService;
  }

  async getCart(userId) {
    let cart = await this.repository.findActiveCartByUserId(userId);

    if (cart) {
      const payload = cart.toJSON();
      // Attach current stock information for each cart item to help frontend validation
      for (const item of payload.items) {
        if (item.variantId) {
          const variant = await this.variantRepository.findById(item.variantId);
          item.variantStock = variant ? Number(variant.stock || 0) : 0;
        } else {
          const product = await this.repository.findProductById(item.productId);
          item.productStock = product ? Number(product.stock || 0) : 0;
        }
      }

      return payload;
    }

    await this.repository.createActiveCart(userId);
    cart = await this.repository.findActiveCartByUserId(userId);
    const payload = cart.toJSON();
    for (const item of payload.items) {
      if (item.variantId) {
        const variant = await this.variantRepository.findById(item.variantId);
        item.variantStock = variant ? Number(variant.stock || 0) : 0;
      } else {
        const product = await this.repository.findProductById(item.productId);
        item.productStock = product ? Number(product.stock || 0) : 0;
      }
    }
    return payload;
  }

  async addItem(userId, payload) {
    const normalizedPayload = this.normalizeAddItemPayload(payload);
    const product = await this.repository.findProductById(normalizedPayload.productId);
    const allVariants = product ? await this.variantRepository.findByProductId(product.id) : [];
    const variant = this.resolveVariant(allVariants, normalizedPayload, product);
    const productImageUrl = variant
      ? product.thumbnailUrl
      : this.resolveProductImage(product, normalizedPayload.selectedImageUrl);
    if (!variant && normalizedPayload.selectedImageUrl) normalizedPayload.selectedImageUrl = productImageUrl;
    if (variant) this.ensureVariantCanBeAdded(variant, normalizedPayload.quantity);
    else this.ensureProductCanBeAdded(product, normalizedPayload.quantity);

    await withTransaction(async (connection) => {
      const cartId = await this.repository.createActiveCart(userId, connection);
      const variantKey = createVariantKey(normalizedPayload);
      const existingItem = await this.repository.findItemByVariantKey(cartId, variantKey, connection);
      const unitPrice = variant ? Number(variant.salePrice ?? variant.price ?? product.salePrice ?? product.price) : (product.salePrice === null ? product.price : Number(product.salePrice));
      const nextQuantity = Number(existingItem?.quantity || 0) + normalizedPayload.quantity;

      if (variant) this.ensureVariantCanBeAdded(variant, nextQuantity); else this.ensureProductCanBeAdded(product, nextQuantity);

      if (existingItem) {
        await this.repository.updateItemQuantity(existingItem.id, nextQuantity, unitPrice, connection);
        return;
      }

      await this.repository.addItem(cartId, {
        productId: product.id,
        variantId: variant?.id || null,
        variantKey,
        size: variant?.size || null,
        color: variant?.color || null,
        productName: product.name,
        productSku: variant?.sku || product.sku,
        productImageUrl,
        unitPrice,
        quantity: normalizedPayload.quantity,
        totalPrice: unitPrice * normalizedPayload.quantity
      }, connection);
    });

    return this.getCart(userId);
  }

  async updateItemQuantity(userId, itemId, quantity) {
    const item = await this.getOwnedItem(userId, itemId);
    const product = await this.repository.findProductById(item.productId);
    const normalizedQuantity = this.normalizeQuantity(quantity);
    const variant = await this.getCurrentVariant(item.variantId);
    if (variant) this.ensureVariantCanBeAdded(variant, normalizedQuantity); else this.ensureProductCanBeAdded(product, normalizedQuantity);

    await this.repository.updateItemQuantity(item.id, normalizedQuantity, item.unitPrice);
    return this.getCart(userId);
  }

  async removeItem(userId, itemId) {
    const item = await this.getOwnedItem(userId, itemId);

    await this.repository.deleteItem(item.id);
    return this.getCart(userId);
  }

  async updateItemSelection(userId, itemId, isSelected) {
    const item = await this.getOwnedItem(userId, itemId);

    await this.repository.updateItemSelection(item.id, Boolean(isSelected));
    return this.getCart(userId);
  }

  async updateAllSelection(userId, isSelected) {
    const cart = await this.repository.findActiveCartByUserId(userId);

    if (!cart) {
      return this.getCart(userId);
    }

    await this.repository.updateAllSelection(cart.id, Boolean(isSelected));
    return this.getCart(userId);
  }

  async checkout(userId, payload) {
    const normalizedPayload = this.normalizeCheckoutPayload(payload);
    const isBuyNow = normalizedPayload.checkoutMode === "buy_now";
    let createdOrderId = null;

    await withTransaction(async (connection) => {
      let selectedItems;
      if (isBuyNow) {
        selectedItems = await this.buildBuyNowItems(normalizedPayload.items, connection);
      } else {
        const cartId = await this.repository.createActiveCart(userId, connection);
        selectedItems = await this.repository.findSelectedItemsByCartId(cartId, connection);
      }

      if (!selectedItems.length) {
        throw new AppError("Cart has no selected items.", 422, "CHECKOUT_EMPTY_CART");
      }


      for (const item of selectedItems) {
        const product = await this.repository.findProductForUpdate(item.productId, connection);
        const variant = await this.getCurrentVariant(item.variantId, connection, true);
        if (variant) this.ensureVariantCanBeAdded(variant, item.quantity); else this.ensureProductCanBeAdded(product, item.quantity);
        item._variant = variant;
      }

      const subtotal = selectedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
      const voucherResult = normalizedPayload.voucherCode
        ? await this.voucherService.validateVoucher({ code: normalizedPayload.voucherCode, orderTotal: subtotal }, { connection, forUpdate: true })
        : null;
      const discountTotal = voucherResult ? Number(voucherResult.discountAmount || 0) : 0;
      const totals = calculateCheckoutTotals({ subtotal, discountTotal });
      const shippingFee = totals.shippingFee;
      const taxTotal = totals.taxTotal;
      const grandTotal = totals.grandTotal;
      const paymentMethod = normalizedPayload.paymentMethod;
      // Checkout never trusts a client-provided paid flag. Gateway placeholders and COD
      // always start pending and can only be paid through the payment status API.
      const isPaid = false;

      createdOrderId = await this.repository.createOrder({
        orderCode: createOrderCode(),
        customerId: userId,
        customerName: normalizedPayload.customerName,
        customerEmail: normalizedPayload.customerEmail,
        customerPhone: normalizedPayload.customerPhone,
        shippingAddress: normalizedPayload.shippingAddress,
        status: "pending",
        paymentStatus: isPaid ? "paid" : "unpaid",
        paymentMethod,
        subtotal,
        discountTotal,
        shippingFee,
        taxTotal,
        grandTotal,
        paidAmount: isPaid ? grandTotal : 0,
        note: normalizedPayload.note
      }, connection);

      await this.repository.createOrderDetails(createdOrderId, selectedItems.map((item) => ({
        productId: item.productId,
        productName: createOrderItemName(item),
        productSku: item.productSku,
        productImageUrl: item.productImageUrl,
        variantId: item.variantId,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      })), connection);

      await this.repository.addOrderHistory(createdOrderId, {
        status: "pending",
        note: "Order created from checkout.",
        changedBy: userId
      }, connection);

      const paymentTransactionId = await this.repository.createPaymentTransaction({
        orderId: createdOrderId,
        paymentMethodId: normalizedPayload.paymentMethodId,
        transactionCode: createPaymentTransactionCode(),
        provider: normalizedPayload.paymentProvider,
        method: paymentMethod,
        amount: grandTotal,
        currency: "VND",
        status: isPaid ? "paid" : "pending",
        paidAt: isPaid ? new Date() : null,
        metadata: {
          source: isBuyNow ? "customer_buy_now_checkout" : "customer_cart_checkout",
          voucherCode: voucherResult?.code || normalizedPayload.voucherCode,
          discountAmount: discountTotal
        }
      }, connection);

      await this.repository.addPaymentHistory(paymentTransactionId, {
        status: isPaid ? "paid" : "pending",
        note: "Payment transaction created from checkout.",
        changedBy: userId
      }, connection);

      if (voucherResult?.code) {
        await this.voucherService.markVoucherUsed(voucherResult.code, connection);
      }

      for (const item of selectedItems) {
        if (item._variant && !await this.variantRepository.updateInventory(item._variant.id, item.quantity, connection)) {
          throw new AppError("Requested quantity exceeds variant stock.", 409, "CART_VARIANT_STOCK_EXCEEDED");
        }
        await this.repository.updateProductInventory(item.productId, item.quantity, connection);
      }

      if (!isBuyNow) {
        await this.repository.deleteItems(selectedItems.map((item) => item.id), connection);
      }
    });

    const [order, cart] = await Promise.all([
      this.repository.findOrderById(createdOrderId),
      this.getCart(userId)
    ]);

    return {
      order: order.toJSON(),
      cart
    };
  }

  normalizeCheckoutPayload(payload = {}) {
    const shippingAddress = payload.shippingAddress || {};
    const paymentMethod = String(payload.paymentMethod || "cod").trim().toLowerCase();
    const fullAddress = normalizeOptionalString(shippingAddress.fullAddress || shippingAddress.full_address || shippingAddress.full_address_text);

    return {
      checkoutMode: String(payload.checkoutMode || "cart").trim().toLowerCase(),
      items: Array.isArray(payload.items) ? payload.items : [],
      customerName: normalizeRequiredString(payload.customerName, "Customer name is required.", "CHECKOUT_CUSTOMER_NAME_REQUIRED"),
      customerEmail: normalizeRequiredString(payload.customerEmail, "Customer email is required.", "CHECKOUT_CUSTOMER_EMAIL_REQUIRED").toLowerCase(),
      customerPhone: normalizeRequiredString(payload.customerPhone, "Customer phone is required.", "CHECKOUT_CUSTOMER_PHONE_REQUIRED"),
      shippingAddress: {
        receiver_name: normalizeOptionalString(shippingAddress.receiver_name || shippingAddress.fullName || payload.customerName),
        receiver_phone: normalizeOptionalString(shippingAddress.receiver_phone || shippingAddress.phone || payload.customerPhone),
        detail_address: normalizeOptionalString(shippingAddress.detail_address || shippingAddress.detailAddress || shippingAddress.line1),
        province_code: normalizeOptionalString(shippingAddress.province_code),
        province_name: normalizeOptionalString(shippingAddress.province_name || shippingAddress.province || shippingAddress.city),
        ward_code: normalizeOptionalString(shippingAddress.ward_code),
        ward_name: normalizeOptionalString(shippingAddress.ward_name || shippingAddress.ward),
        full_address: fullAddress,
        country: normalizeOptionalString(shippingAddress.country) || "Vietnam"
      },
      paymentMethod,
      paymentProvider: String(payload.paymentProvider || paymentMethod).trim().toLowerCase(),
      paymentMethodId: payload.paymentMethodId || null,
      paymentStatus: payload.paymentStatus === "paid" ? "paid" : "unpaid",
      voucherCode: normalizeOptionalString(payload.voucherCode),
      note: normalizeOptionalString(payload.note)
    };
  }

  async buildBuyNowItems(items, connection) {
    if (!Array.isArray(items) || items.length !== 1) {
      throw new AppError("Buy now checkout requires exactly one item.", 422, "BUY_NOW_ITEMS_REQUIRED");
    }

    const rawItem = items[0] || {};
    const payload = this.normalizeAddItemPayload(rawItem);
    const product = await this.repository.findProductForUpdate(payload.productId, connection);
    let variant = null;

    if (payload.variantId) {
      variant = await this.getCurrentVariant(payload.variantId, connection, true);
      if (!variant || Number(variant.productId) !== Number(product?.id)) {
        throw new AppError("Product variant is not available.", 409, "VARIANT_NOT_AVAILABLE");
      }
      if (payload.size && payload.size !== variant.size) {
        throw new AppError("Product variant is not available.", 409, "VARIANT_NOT_AVAILABLE");
      }
      if (payload.color && payload.color !== variant.color) {
        throw new AppError("Product variant is not available.", 409, "VARIANT_NOT_AVAILABLE");
      }
      this.ensureVariantCanBeAdded(variant, payload.quantity);
    } else {
      const variantCount = product ? await this.repository.countActiveVariantsForProduct(product.id, connection) : 0;
      if (variantCount > 0) {
        throw new AppError("Please select size and color.", 422, "CART_VARIANT_REQUIRED");
      }
      this.ensureProductCanBeAdded(product, payload.quantity);
    }

    const requestedImage = rawItem.selectedImageUrl ?? rawItem.selected_image_url
      ?? rawItem.productImageUrl ?? rawItem.product_image_url;
    const productImageUrl = this.resolveProductImage(product, requestedImage);
    const unitPrice = variant
      ? Number(variant.salePrice ?? variant.price ?? product.salePrice ?? product.price)
      : Number(product.salePrice ?? product.price);

    return [{
      id: null,
      productId: product.id,
      variantId: variant?.id || null,
      size: variant?.size || null,
      color: variant?.color || null,
      productName: product.name,
      productSku: variant?.sku || product.sku,
      productImageUrl,
      unitPrice,
      quantity: payload.quantity,
      totalPrice: unitPrice * payload.quantity,
      isSelected: true,
      _variant: variant
    }];
  }

  async getOwnedItem(userId, itemId) {
    const normalizedItemId = Number(itemId);

    if (!Number.isInteger(normalizedItemId) || normalizedItemId < 1) {
      throw new AppError("Cart item was not found.", 404, "CART_ITEM_NOT_FOUND");
    }

    const item = await this.repository.findItemByIdForUser(userId, normalizedItemId);

    if (!item) {
      throw new AppError("Cart item was not found.", 404, "CART_ITEM_NOT_FOUND");
    }

    return item;
  }

  normalizeAddItemPayload(payload = {}) {
    const productId = Number(payload.productId ?? payload.product_id);
    const quantity = Number(payload.quantity || 1);
    const size = normalizeOptionalString(payload.size);
    const color = normalizeOptionalString(payload.color);
    const variantId = normalizeOptionalString(payload.variantId ?? payload.variant_id);
    const selectedImageUrl = normalizeOptionalString(payload.selectedImageUrl ?? payload.selected_image_url);

    if (!Number.isInteger(productId) || productId < 1) {
      throw new AppError("Product is required.", 422, "CART_PRODUCT_REQUIRED");
    }

    this.normalizeQuantity(quantity);

    return {
      productId,
      quantity,
      size,
      color,
      variantId,
      selectedImageUrl
    };
  }

  resolveProductImage(product, selectedImageUrl) {
    const fallback = product?.thumbnailUrl || null;
    if (!selectedImageUrl) return fallback;
    const allowedImages = [fallback, ...(Array.isArray(product?.galleryUrls) ? product.galleryUrls : [])].filter(Boolean);
    const selected = allowedImages.find((imageUrl) => isSameProductImage(imageUrl, selectedImageUrl));
    if (!selected) {
      throw new AppError("Selected product image is invalid.", 422, "CART_SELECTED_IMAGE_INVALID");
    }
    return selected;
  }

  normalizeQuantity(quantity) {
    const normalizedQuantity = Number(quantity);

    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
      throw new AppError("Quantity must be a positive integer.", 422, "INVALID_CART_QUANTITY");
    }

    if (normalizedQuantity > 99) {
      throw new AppError("Quantity is too large.", 422, "CART_QUANTITY_TOO_LARGE");
    }

    return normalizedQuantity;
  }

  ensureProductCanBeAdded(product, requestedQuantity) {
    if (!product || product.status !== "active") {
      throw new AppError("Product is not available.", 404, "PRODUCT_NOT_AVAILABLE");
    }

    if (Number(product.stock || 0) <= 0) {
      throw new AppError("Product is out of stock.", 409, "PRODUCT_OUT_OF_STOCK");
    }

    if (requestedQuantity > Number(product.stock || 0)) {
      throw new AppError("Requested quantity exceeds available stock.", 422, "CART_STOCK_EXCEEDED", {
        stock: product.stock,
        requestedQuantity
      });
    }
  }

  resolveVariant(variants, payload, product) {
    if (!product || product.status !== "active") throw new AppError("Product is not available.", 404, "PRODUCT_NOT_AVAILABLE");
    if (!variants.length) return null;
    if (!payload.variantId || !payload.size || !payload.color) throw new AppError("Please select size and color.", 422, "CART_VARIANT_REQUIRED");
    const variant = variants.find((item) => String(item.id) === String(payload.variantId));
    if (!variant || variant.status !== "active" || variant.size !== payload.size || variant.color !== payload.color) throw new AppError("Product variant is not available.", 409, "VARIANT_NOT_AVAILABLE");
    return variant;
  }

  ensureVariantCanBeAdded(variant, requestedQuantity) {
    if (!variant || variant.status !== "active") throw new AppError("Product variant is not available.", 409, "VARIANT_NOT_AVAILABLE");
    if (Number(variant.stock) <= 0) throw new AppError("Product variant is out of stock.", 409, "VARIANT_OUT_OF_STOCK");
    if (requestedQuantity > Number(variant.stock)) throw new AppError("Requested quantity exceeds variant stock.", 422, "CART_VARIANT_STOCK_EXCEEDED", { stock: variant.stock, requestedQuantity });
  }

  async getCurrentVariant(variantId, connection = null, forUpdate = false) {
    const id = Number(variantId);
    if (!Number.isInteger(id) || id < 1) return null;
    return this.variantRepository.findById(id, { connection, forUpdate });
  }
}


export function calculateCheckoutTotals({ subtotal = 0, discountTotal = 0 } = {}) {
  const normalizedSubtotal = Math.max(Math.round(Number(subtotal || 0)), 0);
  const normalizedDiscount = Math.min(Math.max(Math.round(Number(discountTotal || 0)), 0), normalizedSubtotal);
  const eligibleAmount = Math.max(normalizedSubtotal - normalizedDiscount, 0);
  const taxTotal = Math.round(eligibleAmount * 0.1);
  const shippingFee = eligibleAmount > 0 && eligibleAmount >= 500000 ? 0 : eligibleAmount > 0 ? 30000 : 0;
  const grandTotal = eligibleAmount + taxTotal + shippingFee;

  return {
    subtotal: normalizedSubtotal,
    discountTotal: normalizedDiscount,
    eligibleAmount,
    taxTotal,
    shippingFee,
    grandTotal
  };
}
function normalizeRequiredString(value, message, code) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    throw new AppError(message, 422, code);
  }

  return normalizedValue;
}

function createVariantKey(payload) {
  if (!payload.variantId) {
    const imageKey = payload.selectedImageUrl
      ? `|image:${crypto.createHash("sha256").update(payload.selectedImageUrl).digest("hex").slice(0, 24)}`
      : "";
    return `${payload.productId}|base${imageKey}`;
  }
  return [
    payload.productId,
    payload.variantId,
    payload.size.toLowerCase(),
    payload.color.toLowerCase()
  ].join("|");
}

function isSameProductImage(allowedImageUrl, selectedImageUrl) {
  const allowed = String(allowedImageUrl || "").trim();
  const selected = String(selectedImageUrl || "").trim();
  if (!allowed || !selected) return false;
  if (allowed === selected) return true;
  try {
    const base = "http://local.invalid";
    const allowedUrl = new URL(allowed, base);
    const selectedUrl = new URL(selected, base);
    if (allowedUrl.origin !== base && allowedUrl.origin !== selectedUrl.origin) return false;
    return decodeURIComponent(allowedUrl.pathname) === decodeURIComponent(selectedUrl.pathname)
      && allowedUrl.search === selectedUrl.search;
  } catch {
    return false;
  }
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim();
}

function createOrderCode() {
  return `ORD-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function createPaymentTransactionCode() {
  return `PAY-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function createOrderItemName(item) {
  const variantLabel = [item.color, item.size].filter(Boolean).join(" / ");
  return variantLabel ? `${item.productName} (${variantLabel})` : item.productName;
}

