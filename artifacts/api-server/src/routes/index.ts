import { Router } from "express";
import healthRouter    from "./health";
import productsRouter  from "./products";
import categoriesRouter from "./categories";
import cartRouter      from "./cart";
import ordersRouter    from "./orders";
import paymentsRouter  from "./payments";
import wishlistRouter  from "./wishlist";
import adminRouter     from "./admin";
import staffRouter     from "./staff";
import couponsRouter   from "./coupons";
import settingsRouter  from "./settings";

const router = Router();

router.use("/health",     healthRouter);
router.use("/products",   productsRouter);
router.use("/categories", categoriesRouter);
router.use("/cart",       cartRouter);
router.use("/orders",     ordersRouter);
router.use("/payments",   paymentsRouter);
router.use("/wishlist",   wishlistRouter);
router.use("/admin",      adminRouter);
router.use("/staff",      staffRouter);
router.use("/coupons",    couponsRouter);
router.use("/settings",   settingsRouter);

export default router;
