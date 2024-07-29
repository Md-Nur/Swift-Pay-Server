import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { cashIn, cashOut, sendMoney } from "../controllers/transaction.controller.js";

const router = Router();

// Secure Routes
router.route("/send-money").post(verifyJWT, sendMoney);
router.route("/cash-out").post(verifyJWT, cashOut);
router.route("/cash-in").post(verifyJWT, cashIn);

export default router;
