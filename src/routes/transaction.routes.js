import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { cashOut, sendMoney } from "../controllers/transaction.controller.js";

const router = Router();

// Secure Routes
router.route("/send-money").post(verifyJWT, sendMoney);
router.route("/cash-out").post(verifyJWT, cashOut);

export default router;
