import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  refreshAccessToken,
  getCurrentUser,
  getAllUsers,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);

//secured routes
router.route("/logout").get(verifyJWT, logoutUser);
router.route("/get-user").get(verifyJWT, getCurrentUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/").get(verifyJWT, getAllUsers);

export default router;
