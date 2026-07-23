import test from "node:test";
import assert from "node:assert/strict";

import { UserService } from "../services/user.service.js";
import { User } from "../models/user.model.js";
import { hashPassword } from "../utils/password.util.js";

function createUser(overrides = {}) {
  return new User({
    id: 7,
    email: "customer@example.com",
    full_name: "Customer Name",
    phone: "0901234567",
    password_hash: overrides.password_hash,
    role: "CUSTOMER",
    permissions: "[]",
    status: "active",
    address_json: JSON.stringify({ line1: "Old address", country: "Vietnam" }),
    ...overrides
  });
}

function createRepository(user) {
  const calls = {
    findByIdWithAuth: [],
    findByEmail: [],
    findByPhone: [],
    updateProfile: []
  };

  return {
    calls,
    async findByIdWithAuth(id) {
      calls.findByIdWithAuth.push(id);
      return user;
    },
    async findByEmail(email, excludedId = null) {
      calls.findByEmail.push({ email, excludedId });
      return null;
    },
    async findByPhone(phone, excludedId = null) {
      calls.findByPhone.push({ phone, excludedId });
      return null;
    },
    async updateProfile(id, payload) {
      calls.updateProfile.push({ id, payload });
      return createUser({
        ...user,
        email: payload.email ?? user.email,
        phone: payload.phone ?? user.phone,
        full_name: payload.fullName ?? user.fullName,
        address_json: JSON.stringify(payload.address ?? user.address),
        password_hash: user.passwordHash
      });
    }
  };
}

test("profile phone update uses current_password with bcrypt compare", async () => {
  const passwordHash = await hashPassword("Same password 123!");
  const repository = createRepository(createUser({ password_hash: passwordHash }));
  const service = new UserService(repository, {});

  const result = await service.updateProfile(7, {
    phone: "0909999999",
    current_password: "Same password 123!"
  });

  assert.equal(result.phone, "0909999999");
  assert.deepEqual(repository.calls.findByPhone, [{ phone: "0909999999", excludedId: 7 }]);
  assert.equal(repository.calls.updateProfile[0].payload.phone, "0909999999");
});

test("profile address update does not require current_password", async () => {
  const passwordHash = await hashPassword("Same password 123!");
  const repository = createRepository(createUser({ password_hash: passwordHash }));
  const service = new UserService(repository, {});

  await service.updateProfile(7, {
    address: { line1: "New address", provinceName: "Hồ Chí Minh", wardName: "Bến Nghé", country: "Vietnam" }
  });

  assert.equal(repository.calls.findByEmail.length, 0);
  assert.equal(repository.calls.findByPhone.length, 0);
  assert.equal(repository.calls.updateProfile[0].payload.address.line1, "New address");
});

test("profile update rejects wrong current_password only when login fields change", async () => {
  const passwordHash = await hashPassword("Same password 123!");
  const repository = createRepository(createUser({ password_hash: passwordHash }));
  const service = new UserService(repository, {});

  await assert.rejects(
    () => service.updateProfile(7, { phone: "0908888888", current_password: "Wrong password" }),
    { code: "CURRENT_PASSWORD_INVALID", statusCode: 401 }
  );

  assert.equal(repository.calls.updateProfile.length, 0);
});

test("unchanged email and phone skip password verification and duplicate checks", async () => {
  const passwordHash = await hashPassword("Same password 123!");
  const repository = createRepository(createUser({ password_hash: passwordHash }));
  const service = new UserService(repository, {});

  await service.updateProfile(7, {
    email: "customer@example.com",
    phone: "0901234567",
    fullName: "Customer Name Updated"
  });

  assert.equal(repository.calls.findByEmail.length, 0);
  assert.equal(repository.calls.findByPhone.length, 0);
  assert.equal(repository.calls.updateProfile[0].payload.fullName, "Customer Name Updated");
});
