/**
 * Cart validators.
 * They validate customer add-to-cart payloads before service-level stock checks.
 */
import { createValidationError, createValidationResult, isEmpty } from "./base.validator.js";
import { validateEmail } from "./email.validator.js";
import { validateId } from "./id.validator.js";
import { validatePhone } from "./phone.validator.js";

export function validateAddCartItemRequest({ body }) {
  const errors = [];

  const productId = body.productId ?? body.product_id;
  const variantId = body.variantId ?? body.variant_id;
  const selectedImageUrl = body.selectedImageUrl ?? body.selected_image_url;
  errors.push(...validateId(productId, { required: true, field: "productId", location: "body" }).errors);

  const quantity = Number(body.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1) {
    errors.push(createValidationError("quantity", "quantity must be a positive integer.", "body", "INVALID_CART_QUANTITY"));
  }

  if (quantity > 99) {
    errors.push(createValidationError("quantity", "quantity must not exceed 99.", "body", "CART_QUANTITY_TOO_LARGE"));
  }

  if (!isEmpty(variantId) && String(variantId).length > 100) {
    errors.push(createValidationError("variantId", "variantId must not exceed 100 characters.", "body", "INVALID_CART_VARIANT"));
  }

  if (!isEmpty(selectedImageUrl) && (typeof selectedImageUrl !== "string" || selectedImageUrl.length > 2048)) {
    errors.push(createValidationError("selected_image_url", "selected_image_url must be a string not exceeding 2048 characters.", "body", "INVALID_CART_SELECTED_IMAGE"));
  }

  return createValidationResult(errors);
}

export function validateUpdateCartItemRequest({ body }) {
  const errors = [];
  const quantity = Number(body.quantity);

  if (!Number.isInteger(quantity) || quantity < 1) {
    errors.push(createValidationError("quantity", "quantity must be a positive integer.", "body", "INVALID_CART_QUANTITY"));
  }

  if (quantity > 99) {
    errors.push(createValidationError("quantity", "quantity must not exceed 99.", "body", "CART_QUANTITY_TOO_LARGE"));
  }

  return createValidationResult(errors);
}

export function validateCartSelectionRequest({ body }) {
  const errors = [];

  if (typeof body.isSelected !== "boolean") {
    errors.push(createValidationError("isSelected", "isSelected must be a boolean.", "body", "INVALID_CART_SELECTION"));
  }

  return createValidationResult(errors);
}

export function validateCheckoutRequest({ body }) {
  const errors = [];
  const address = body.shippingAddress || {};

  if (isEmpty(body.customerName)) {
    errors.push(createValidationError("customerName", "customerName is required.", "body", "CHECKOUT_CUSTOMER_NAME_REQUIRED"));
  }

  errors.push(...validateEmail(body.customerEmail, { required: true, field: "customerEmail", location: "body" }).errors);
  errors.push(...validatePhone(body.customerPhone, { required: true, field: "customerPhone", location: "body", country: "VN" }).errors);

  ["receiver_name", "receiver_phone", "detail_address", "province_name", "ward_name"].forEach((field) => {
    if (isEmpty(address[field])) {
      errors.push(createValidationError(`shippingAddress.${field}`, `${field} is required.`, "body", "CHECKOUT_SHIPPING_REQUIRED"));
    }
  });

  if (!isEmpty(address.phone)) {
    errors.push(...validatePhone(address.phone, { field: "shippingAddress.phone", location: "body", country: "VN" }).errors);
  }

  if (!isEmpty(body.paymentMethod) && !["cod", "bank_transfer", "momo", "vnpay"].includes(String(body.paymentMethod).toLowerCase())) {
    errors.push(createValidationError("paymentMethod", "paymentMethod is invalid.", "body", "INVALID_PAYMENT_METHOD"));
  }

  if (!isEmpty(body.shippingFee) && Number(body.shippingFee) < 0) {
    errors.push(createValidationError("shippingFee", "shippingFee must be greater than or equal to 0.", "body", "INVALID_SHIPPING_FEE"));
  }


  if (!isEmpty(body.voucherCode) && String(body.voucherCode).length > 80) {
    errors.push(createValidationError("voucherCode", "voucherCode must not exceed 80 characters.", "body", "INVALID_VOUCHER_CODE"));
  }

  const checkoutMode = String(body.checkoutMode || "cart").toLowerCase();
  if (!["cart", "buy_now"].includes(checkoutMode)) {
    errors.push(createValidationError("checkoutMode", "checkoutMode is invalid.", "body", "INVALID_CHECKOUT_MODE"));
  }

  if (checkoutMode === "buy_now") {
    if (!Array.isArray(body.items) || body.items.length !== 1) {
      errors.push(createValidationError("items", "Buy now checkout requires exactly one item.", "body", "BUY_NOW_ITEMS_REQUIRED"));
    } else {
      const item = body.items[0] || {};
      errors.push(...validateId(item.productId ?? item.product_id, { required: true, field: "items.0.product_id", location: "body" }).errors);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        errors.push(createValidationError("items.0.quantity", "quantity must be an integer from 1 to 99.", "body", "INVALID_CART_QUANTITY"));
      }
      const variantId = item.variantId ?? item.variant_id;
      if (!isEmpty(variantId)) {
        errors.push(...validateId(variantId, { field: "items.0.variant_id", location: "body" }).errors);
      }
      const image = item.selectedImageUrl ?? item.selected_image_url ?? item.productImageUrl ?? item.product_image_url;
      if (!isEmpty(image) && (typeof image !== "string" || image.length > 2048)) {
        errors.push(createValidationError("items.0.selected_image_url", "selected_image_url is invalid.", "body", "INVALID_CART_SELECTED_IMAGE"));
      }
    }
  }

  return createValidationResult(errors);
}
