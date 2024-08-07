import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  cashIn,
  cashOut,
  getTransaction,
  sendMoney,
  transactionApproval,
} from "../controllers/transaction.controller.js";

const router = Router();

// Secure Routes
router.route("/").post(verifyJWT, getTransaction);
router.route("/send-money").post(verifyJWT, sendMoney);
router.route("/cash-out").post(verifyJWT, cashOut);
router.route("/cash-in").post(verifyJWT, cashIn);
router.route("/approve").post(verifyJWT, transactionApproval);

export default router;
