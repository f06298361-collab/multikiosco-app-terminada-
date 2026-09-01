import { Router, type IRouter } from "express";
import healthRouter from "./health";
import productsRouter from "./products";
import ordersRouter from "./orders";
import settingsRouter from "./settings";
import authRouter from "./auth";
import superadminRouter from "./superadmin";
import { ensureSeedData } from "../lib/seed";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(superadminRouter);
router.use(productsRouter);
router.use(ordersRouter);
router.use(settingsRouter);

ensureSeedData().catch((err) => {
  logger.error({ err }, "Failed to seed data");
});

export default router;
