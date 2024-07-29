import Transaction from "../models/transaction.model.js";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const sendMoney = asyncHandler(async (req, res) => {
  // get transaction from frontend
  let { reqPhone, resPhone, pin, amount } = req.body;

  // validation - not empty fields
  if (
    [reqPhone, resPhone, pin, amount].find(
      (field) => field.toString().trim() === ""
    )
  ) {
    res.status(404).json(new ApiError(404, "Every field is required!"));
  }
  amount = parseInt(amount);

  // check same phone number
  if (reqPhone === resPhone) {
    res
      .status(501)
      .json(new ApiError(501, "You can't send money to your number"));
  }

  // Find user
  const reqUser = await User.findOne({ mobileNumber: reqPhone });

  if (!reqUser) {
    res.status(404).json(new ApiError(404, "You don't have any account"));
  }

  const isPinValid = await reqUser.isPinCorrect(pin);

  if (!isPinValid) {
    res.status(401).json(new ApiError(401, "Invalid Credential!"));
  }

  const resUser = await User.findOne({ mobileNumber: resPhone });

  if (!resUser) {
    res
      .status(404)
      .json(new ApiError(404, "There have no receiver with this phone number"));
  }

  // Check the user is approved or block
  if (!resUser.isApproved || resUser.accountStatus === "Blocked") {
    res
      .status(401)
      .json(new ApiError(401, "Receiver is not approved / blocked by admin"));
  }

  // check Sufficient Amount
  if (amount < 50) {
    res.status(500).json(new ApiError(500, "You have to send minimun 50 taka"));
  }

  let fee = amount > 100 ? 5 : 0;

  if (reqUser.balance < amount + fee) {
    return res
      .status(500)
      .json(
        new ApiError(500, "You don't have sufficient balance to transfer!")
      );
  }

  // Add a tranction in both req and res user
  const tranction = await Transaction.create({
    reqPhone,
    resPhone,
    method: "sendMoney",
    amount,
    fee,
    isPending: false,
  });

  if (!tranction) {
    res.status(500).json(new ApiError(500, "Transaction failed!!"));
  }

  // decrease and increate req user and res user balance through the amount and fees respectively
  try {
    reqUser.balance = reqUser.balance - (amount + fee);
    resUser.balance = resUser.balance + amount;
    await reqUser.save();
    await resUser.save();
  } catch (error) {
    res
      .status(500)
      .json(
        new ApiError(500, error.message || "Can't add money to the sender")
      );
  }

  // send response
  res
    .status(201)
    .send(new ApiResponse(201, tranction, "Send money successfully"));
});

const cashOut = asyncHandler(async (req, res) => {
  // get transaction from frontend
  let { reqPhone, resPhone, pin, amount } = req.body;

  // validation - not empty fields
  if (
    [reqPhone, pin, resPhone, amount].find(
      (field) => field.toString().trim() === ""
    )
  ) {
    res.status(404).json(new ApiError(404, "Every field is required!"));
  }
  amount = parseInt(amount);

  // Find user
  const reqUser = await User.findOne({ mobileNumber: reqPhone });

  if (!reqUser) {
    res.status(404).json(new ApiError(404, "You don't have any account"));
  }

  const isPinValid = await reqUser.isPinCorrect(pin);

  if (!isPinValid) {
    res.status(401).json(new ApiError(401, "Invalid Credential!"));
  }

  const resUser = await User.findOne({ mobileNumber: resPhone });

  // check the there have no user with this phone number
  if (!resUser || resUser.type !== "Agent") {
    res
      .status(404)
      .json(new ApiError(404, "There have no Agent with this phone number"));
  }

  // Check the user is approved or block
  if (
    !reqUser.isApproved ||
    reqUser.accountStatus === "Blocked" ||
    resUser.accountStatus === "Blocked" ||
    !resUser.isApproved
  ) {
    res
      .status(401)
      .json(new ApiError(401, "Agent is not approved / blocked by admin"));
  }

  // calculate the fee
  let fee = amount * 0.015;

  if (reqUser.balance < amount + fee) {
    return res
      .status(500)
      .json(
        new ApiError(500, "You don't have sufficient balance to transfer!")
      );
  }

  // Add a tranction in req user
  const tranction = await Transaction.create({
    reqPhone,
    resPhone,
    method: "cashOut",
    amount,
    fee,
    isPending: true,
  });

  if (!tranction) {
    res.status(500).json(new ApiError(500, "Transaction failed!!"));
  }

  // decrease req user balance through the amount and fees respectively after approval
  // try {
  //   reqUser.balance = reqUser.balance - (amount + fee);
  //   await reqUser.save();
  // } catch (error) {
  //   res
  //     .status(500)
  //     .json(
  //       new ApiError(500, error.message || "Can't add money to the sender")
  //     );
  // }

  // send response
  res
    .status(201)
    .send(new ApiResponse(201, tranction, "Request for cash out successfully"));
});

export { sendMoney, cashOut };
