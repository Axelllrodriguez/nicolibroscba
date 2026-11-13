import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import storefrontRouter from "./storefront.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storefrontRouter);
router.use(adminRouter);

export default router;
