import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { sendMoney } from "../controllers/transaction.controller.js";

const router = Router();

// Secure Routes
router.route("/send-money").post(verifyJWT, sendMoney);

export default router;
