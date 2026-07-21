import { Router } from "express";
import { NotificationController } from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/authentication.middleware.js";

const router = Router();
const controller = new NotificationController();

router.use(authenticate);
router.get("/", controller.index);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

export default router;
