import test from "node:test";
import assert from "node:assert/strict";

import { UserService } from "../services/user.service.js";

function createPayload(overrides = {}) {
  return {
    email: "new@example.com",
    fullName: "Nguyen Van A",
    phone: "0901234567",
    password: "Abc@1234",
    address: { line1: "tp HCM", country: "Vietnam" },
    ...overrides
  };
}

function createRepository(overrides = {}) {
  const calls = { create: 0 };
  return {
    calls,
    findByEmail: async () => null,
    findByPhone: async () => null,
    create: async () => {
      calls.create += 1;
      return { toJSON: () => ({ id: 1 }) };
    },
    ...overrides
  };
}

test("createUser returns field error when phone already exists before insert", async () => {
  const repository = createRepository({ findByPhone: async () => ({ id: 2 }) });
  const service = new UserService(repository, {});

  await assert.rejects(() => service.createUser(createPayload()), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, "USER_PHONE_EXISTS");
    assert.equal(error.details?.[0]?.field, "phone");
    assert.equal(error.details?.[0]?.message, "Số điện thoại này đã được sử dụng.");
    return true;
  });
  assert.equal(repository.calls.create, 0);
});

test("createUser maps database unique phone constraint to field error", async () => {
  const duplicate = new Error("Duplicate entry '0901234567' for key 'uq_users_phone'");
  duplicate.code = "ER_DUP_ENTRY";
  duplicate.sqlMessage = "Duplicate entry '0901234567' for key 'uq_users_phone'";
  const repository = createRepository({ create: async () => { throw duplicate; } });
  const service = new UserService(repository, {});

  await assert.rejects(() => service.createUser(createPayload()), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, "USER_PHONE_EXISTS");
    assert.equal(error.details?.[0]?.field, "phone");
    return true;
  });
});

test("createUser maps database unique email constraint to field error", async () => {
  const duplicate = new Error("Duplicate entry 'new@example.com' for key 'email'");
  duplicate.code = "ER_DUP_ENTRY";
  duplicate.sqlMessage = "Duplicate entry 'new@example.com' for key 'email'";
  const repository = createRepository({ create: async () => { throw duplicate; } });
  const service = new UserService(repository, {});

  await assert.rejects(() => service.createUser(createPayload()), (error) => {
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, "USER_EMAIL_EXISTS");
    assert.equal(error.details?.[0]?.field, "email");
    return true;
  });
});
