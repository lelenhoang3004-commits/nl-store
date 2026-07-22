import { Router } from "express";
import { AUTH_ROLES } from "../config/auth.config.js";
import { NotificationController } from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();
const controller = new NotificationController();

router.use(authenticate, authorizeRoles(AUTH_ROLES.ADMIN, AUTH_ROLES.STAFF));
router.use((request, response, next) => {
  request.notificationAudience = "ADMIN";
  next();
});
router.get("/", controller.index);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

export default router;
