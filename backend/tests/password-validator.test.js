import test from "node:test";
import assert from "node:assert/strict";

import { STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_PATTERN, validatePassword } from "../validators/password.validator.js";
import { validateRegisterRequest } from "../validators/auth.validator.js";

const invalidPasswords = [
  "12345678",
  "abcdefgh",
  "ABCDEFGH",
  "Abcdefgh",
  "Abcd1234",
  "abcd@123",
  "ABCD@123"
];

const validPasswords = [
  "Abc@1234",
  "NlStore@2026"
];

test("strong password policy matches register requirements", () => {
  for (const password of invalidPasswords) {
    assert.equal(STRONG_PASSWORD_PATTERN.test(password), false, `${password} should be invalid`);
    const result = validatePassword(password, { required: true, strong: true });
    assert.equal(result.isValid, false, `${password} should fail backend validation`);
    assert.equal(result.errors[0]?.message, STRONG_PASSWORD_MESSAGE);
  }

  for (const password of validPasswords) {
    assert.equal(STRONG_PASSWORD_PATTERN.test(password), true, `${password} should be valid`);
    assert.equal(validatePassword(password, { required: true, strong: true }).isValid, true);
  }
});

test("register validation reports confirm password mismatch specifically", () => {
  const result = validateRegisterRequest({
    body: {
      fullName: "Nguyen Van A",
      phone: "0901234567",
      address: "123 Nguyen Trai",
      email: "customer@example.com",
      password: "NlStore@2026",
      confirmPassword: "NlStore@2025",
      acceptTerms: true
    }
  });

  assert.equal(result.isValid, false);
  assert.deepEqual(
    result.errors.filter((error) => error.field === "confirmPassword").map((error) => error.message),
    ["M\u1eadt kh\u1ea9u x\u00e1c nh\u1eadn kh\u00f4ng kh\u1edbp."]
  );
  assert.equal(result.errors.some((error) => error.message === "Validation failed."), false);
});
