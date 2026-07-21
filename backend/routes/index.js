/**
 * Backend route registry.
 * Feature routers are mounted here so app.js remains stable as modules grow.
 */
import { Router } from "express";
import authRoutes from "./auth.routes.js";
import adminOrderRoutes from "./admin-order.route.js";
import adminPaymentRoutes from "./admin-payment.route.js";
import adminProductRoutes from "./admin-product.route.js";
import adminUserRoutes from "./admin-user.route.js";
import adminVoucherRoutes from "./admin-voucher.route.js";
import adminDashboardRoutes from "./admin-dashboard.route.js";
import adminNewsletterRoutes from "./admin-newsletter.route.js";
import adminCategoryRoutes from "./admin-category.route.js";
import cartRoutes from "./cart.routes.js";
import categoryRoutes from "./category.routes.js";
import chatbotRoutes from "./chatbot.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import newsletterRoutes from "./newsletter.routes.js";
import notificationRoutes from "./notification.routes.js";
import orderRoutes from "./order.routes.js";
import paymentRoutes from "./payment.routes.js";
import productRoutes from "./product.routes.js";
import securityRoutes from "./security.routes.js";
import uploadRoutes from "./upload.routes.js";
import userRoutes from "./user.routes.js";
import voucherRoutes from "./voucher.routes.js";
import wishlistRoutes from "./wishlist.routes.js";

const router = Router();

router.use("/admin/dashboard", adminDashboardRoutes);
router.use("/admin/newsletter", adminNewsletterRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/admin/orders", adminOrderRoutes);
router.use("/admin/payments", adminPaymentRoutes);
router.use("/admin/products", adminProductRoutes);
router.use("/admin/users", adminUserRoutes);
router.use("/admin/vouchers", adminVoucherRoutes);
router.use("/auth", authRoutes);
router.use("/cart", cartRoutes);
router.use("/categories", categoryRoutes);
router.use("/chatbot", chatbotRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/newsletter", newsletterRoutes);
router.use("/notifications", notificationRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/products", productRoutes);
router.use("/wishlist", wishlistRoutes);
router.use("/security", securityRoutes);
router.use("/uploads", uploadRoutes);
router.use("/users", userRoutes);
router.use("/vouchers", voucherRoutes);

export default router;

