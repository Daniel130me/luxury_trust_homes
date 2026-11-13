import { Router } from "express";

/**
 * Central API router. Every module mounts under /api.
 */
const router = Router();

import authRoutes from "../modules/auth/routes.js";
import userRoutes from "../modules/users/routes.js";
import propertyRoutes from "../modules/properties/routes.js";
import enquiryRoutes from "../modules/enquiries/routes.js";
import paymentRoutes from "../modules/payments/routes.js";
import uploadRoutes from "../modules/uploads/routes.js";
import notificationRoutes from "../modules/notifications/routes.js";
import ticketRoutes from "../modules/tickets/routes.js";
import adminRoutes from "../modules/admin/routes.js";

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/", propertyRoutes); // /properties, /provider-properties, /staff/listings, /saved
router.use("/", enquiryRoutes); // /enquiries, /staff/enquiries, /staff/matters, /cases, /provider/cases
router.use("/", paymentRoutes); // /client/payments, /staff/payments, /payments/webhook
router.use("/uploads", uploadRoutes);
router.use("/notifications", notificationRoutes);
router.use("/tickets", ticketRoutes);
router.use("/", adminRoutes); // /staff/summary, /client/summary, /provider/summary, /reports, /settings, /contact

export default router;
