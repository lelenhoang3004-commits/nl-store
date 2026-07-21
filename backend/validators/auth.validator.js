import { createValidationError, createValidationResult, isEmpty, mergeValidationResults, validateRequired } from "./base.validator.js";
import { validateEmail } from "./email.validator.js";
import { validatePassword } from "./password.validator.js";
import { validatePhone } from "./phone.validator.js";
export function validateLoginRequest({ body }) {
  const errors = []; const identifier = body.email ?? body.identifier;
  const required = validateRequired(identifier, "email", "body"); if (required) errors.push(required);
  if (body.remember !== undefined && typeof body.remember !== "boolean") errors.push(createValidationError("remember", "remember must be a boolean.", "body", "INVALID_REMEMBER_VALUE"));
  return mergeValidationResults([validatePassword(body.password, { required: true, strong: false, minLength: 1 }), createValidationResult(errors)]);
}
export function validateRegisterRequest({ body }) {
  const errors = []; const fullNameError = validateRequired(body.fullName, "fullName", "body"); if (fullNameError) errors.push(fullNameError);
  if (!isEmpty(body.fullName) && String(body.fullName).trim().length > 150) errors.push(createValidationError("fullName", "Họ tên quá dài.", "body", "FULL_NAME_TOO_LONG"));
  if (body.password !== body.confirmPassword) errors.push(createValidationError("confirmPassword", "Xác nhận mật khẩu không khớp.", "body", "PASSWORD_CONFIRMATION_MISMATCH"));
  if (body.acceptTerms !== true) errors.push(createValidationError("acceptTerms", "Bạn cần đồng ý với điều khoản sử dụng.", "body", "TERMS_NOT_ACCEPTED"));
  const addressError = validateRequired(body.address, "address", "body"); if (addressError) errors.push(addressError);
  return mergeValidationResults([validateEmail(body.email, { required: true }), validatePhone(body.phone, { required: true, country: "VN" }), validatePassword(body.password, { required: true, strong: true }), createValidationResult(errors)]);
}
export function validateSendOtpRequest({ body }) { return validatePhone(body.phone, { required: true, country: "VN" }); }
export function validateVerifyOtpRequest({ body }) {
  const errors = []; if (!/^\d{6}$/.test(String(body.otp || ""))) errors.push(createValidationError("otp", "Mã OTP phải gồm 6 chữ số.", "body", "INVALID_OTP_FORMAT"));
  const results = [validatePhone(body.phone, { required: true, country: "VN" })];
  if (body.password || body.confirmPassword) { results.push(validatePassword(body.password, { required: true, strong: true })); if (body.password !== body.confirmPassword) errors.push(createValidationError("confirmPassword", "Xác nhận mật khẩu không khớp.", "body", "PASSWORD_CONFIRMATION_MISMATCH")); }
  return mergeValidationResults([...results, createValidationResult(errors)]);
}
export function validateForgotPasswordRequest({ body }) {
  return validateEmail(body.email, { required: true });
}

export function validateResetPasswordRequest({ body }) {
  const errors = [];
  if (!/^\d{6}$/.test(String(body.code || ""))) {
    errors.push(createValidationError("code", "Mã xác thực phải gồm 6 chữ số.", "body", "INVALID_RESET_CODE_FORMAT"));
  }
  if (body.password !== body.confirmPassword) {
    errors.push(createValidationError("confirmPassword", "Xác nhận mật khẩu không khớp.", "body", "PASSWORD_CONFIRMATION_MISMATCH"));
  }
  return mergeValidationResults([
    validateEmail(body.email, { required: true }),
    validatePassword(body.password, { required: true, strong: true }),
    createValidationResult(errors)
  ]);
}

