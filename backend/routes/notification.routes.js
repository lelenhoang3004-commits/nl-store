import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";

const router = Router();
const controller = new NotificationController();

router.use(authenticate);
router.use((request, response, next) => {
  request.notificationAudience = "CUSTOMER";
  next();
});
router.get("/", controller.index);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

export default router;
