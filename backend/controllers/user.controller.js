/**
 * User controller.
 * It handles HTTP request/response concerns for user CRUD, profile, avatar, and address updates.
 */
import { BaseController } from "./base.controller.js";
import { UserService } from "../services/user.service.js";
import { asyncHandler } from "../utils/async-handler.util.js";

export class UserController extends BaseController {
  constructor(service = new UserService()) {
    super();
    this.service = service;
  }

  index = asyncHandler(async (request, response) => {
    const result = await this.service.getUsers(request.query);

    return this.sendSuccess(
      response,
      {
        users: result.users
      },
      "Users retrieved successfully.",
      200,
      result.meta
    );
  });

  show = asyncHandler(async (request, response) => {
    const user = await this.service.getUserById(request.params.id);

    return this.sendSuccess(response, {
      user
    }, "User retrieved successfully.");
  });

  store = asyncHandler(async (request, response) => {
    const user = await this.service.createUser(request.body);

    return this.sendSuccess(response, {
      user
    }, "User created successfully.", 201);
  });

  update = asyncHandler(async (request, response) => {
    const user = await this.service.updateUser(request.params.id, request.body);

    return this.sendSuccess(response, {
      user
    }, "User updated successfully.");
  });

  destroy = asyncHandler(async (request, response) => {
    const user = await this.service.deleteUser(request.params.id, request.user.id);

    return this.sendSuccess(response, {
      user
    }, "User deleted successfully.");
  });

  profile = asyncHandler(async (request, response) => {
    const user = await this.service.getProfile(request.user.id);

    return this.sendSuccess(response, {
      user
    }, "Profile retrieved successfully.");
  });

  updateProfile = asyncHandler(async (request, response) => {
    const user = await this.service.updateProfile(request.user.id, request.body);

    return this.sendSuccess(response, {
      user
    }, "Profile updated successfully.");
  });

  uploadAvatar = asyncHandler(async (request, response) => {
    const result = await this.service.updateAvatar(request.user.id, request.file);

    return this.sendSuccess(response, result, "Avatar uploaded successfully.", 201);
  });

  changePassword = asyncHandler(async (request, response) => {
    const result = await this.service.changePassword(request.user.id, request.body);

    return this.sendSuccess(response, result, "Password changed successfully.");
  });

  setPassword = asyncHandler(async (request, response) => {
    const result = await this.service.setPassword(request.user.id, request.body);

    return this.sendSuccess(response, result, "Password set successfully.");
  });

  socialConnections = asyncHandler(async (request, response) => {
    const result = await this.service.getSocialConnections(request.user.id);

    return this.sendSuccess(response, result, "Social connections retrieved successfully.");
  });

  socialLinkIntent = asyncHandler(async (request, response) => {
    const result = await this.service.createSocialLinkIntent(request.params.provider);

    return this.sendSuccess(response, result, result.message);
  });

  unlinkSocialConnection = asyncHandler(async (request, response) => {
    const result = await this.service.unlinkSocialConnection(request.user.id, request.params.provider);

    return this.sendSuccess(response, result, "Social connection unlinked successfully.");
  });

  paymentMethods = asyncHandler(async (request, response) => {
    const paymentMethods = await this.service.getPaymentMethods(request.user.id);

    return this.sendSuccess(response, { paymentMethods }, "Payment methods retrieved successfully.");
  });

  storePaymentMethod = asyncHandler(async (request, response) => {
    const result = await this.service.createPaymentMethod(request.user.id, request.body);

    return this.sendSuccess(response, result, result.message, 201);
  });

  setDefaultPaymentMethod = asyncHandler(async (request, response) => {
    const paymentMethod = await this.service.setDefaultPaymentMethod(request.user.id, request.params.id);

    return this.sendSuccess(response, { paymentMethod }, "Default payment method updated successfully.");
  });

  deletePaymentMethod = asyncHandler(async (request, response) => {
    const result = await this.service.deletePaymentMethod(request.user.id, request.params.id);

    return this.sendSuccess(response, result, "Payment method deleted successfully.");
  });
}
