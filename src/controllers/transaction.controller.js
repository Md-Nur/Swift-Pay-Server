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
    return res.status(404).json(new ApiError(404, "Every field is required!"));
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
    return res.status(404).json(new ApiError(404, "You don't have any account"));
  }

  const isPinValid = await reqUser.isPinCorrect(pin);

  if (!isPinValid) {
    return res.status(401).json(new ApiError(401, "Incorrect Pin!"));
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

  if (reqUser.type !== resUser.type || resUser.type !== "User") {
    return res
      .status(420)
      .json(new ApiError(420, "Send money only allow to a user!"));
  }
  if (amount < 50) {
    // check Sufficient Amount
    return res.status(500).json(new ApiError(500, "You have to send minimun 50 taka"));
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
    return res.status(500).json(new ApiError(500, "Transaction failed!!"));
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
    return res.status(404).json(new ApiError(404, "Every field is required!"));
  }
  amount = parseInt(amount);

  // Find user
  const reqUser = await User.findOne({ mobileNumber: reqPhone });

  if (!reqUser) {
    return res.status(404).json(new ApiError(404, "You don't have any account"));
  }

  const isPinValid = await reqUser.isPinCorrect(pin);

  if (!isPinValid) {
    return res.status(401).json(new ApiError(401, "Incorrect Pin!"));
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
    return res.status(500).json(new ApiError(500, "Transaction failed!!"));
  }

  // decrease req user balance through the amount and fees respectively
  try {
    reqUser.balance = reqUser.balance - (amount + fee);
    resUser.balance = resUser.balance + amount + fee;
    await resUser.save();
    await reqUser.save();
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
    .send(new ApiResponse(201, tranction, "Request for cash out successfully"));
});

const cashIn = asyncHandler(async (req, res) => {
  // get transaction from frontend
  let { reqPhone, resPhone, pin, amount } = req.body;

  // validation - not empty fields
  if (
    [reqPhone, pin, resPhone, amount].find(
      (field) => field.toString().trim() === ""
    )
  ) {
    return res.status(404).json(new ApiError(404, "Every field is required!"));
  }
  amount = parseInt(amount);

  // Find user
  const reqUser = await User.findOne({ mobileNumber: reqPhone });

  if (!reqUser || reqUser?.type !== "User") {
    res
      .status(404)
      .json(new ApiError(404, "You aren't allow to perform cash in"));
  }

  const isPinValid = await reqUser.isPinCorrect(pin);

  if (!isPinValid) {
    return res.status(401).json(new ApiError(401, "Incorrect Pin!"));
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

  // Add a tranction in req user
  const tranction = await Transaction.create({
    reqPhone,
    resPhone,
    method: "cashIn",
    amount,
    fee: 0,
    isPending: true,
  });

  if (!tranction) {
    return res.status(500).json(new ApiError(500, "Transaction failed!!"));
  }

  // send response
  res
    .status(201)
    .send(new ApiResponse(201, tranction, "Request for cash in successfully"));
});

const cashInApproval = asyncHandler(async (req, res) => {
  // Get Data from frontedn
  const { tranctionId } = req.body;
  if (!tranctionId) {
    return res
      .status(404)
      .json(new ApiError(404, "Transaction ID is required"));
  }

  // Find the transaction
  const transaction = await Transaction.findById(tranctionId);
  if (!transaction) {
    return res.status(404).json(new ApiError(404, "Transaction not found"));
  }

  // Find the req and res user
  const reqUser = await User.findOne({ mobileNumber: transaction.reqPhone });
  const resUser = await User.findOne({ mobileNumber: transaction.resPhone });

  if (
    !reqUser ||
    !resUser ||
    resUser.type !== "Agent" ||
    !reqUser.isApproved ||
    !resUser.isApproved ||
    reqUser.accountStatus === "Blocked" ||
    resUser.accountStatus === "Blocked" ||
    req.user.type !== "Agent"
  ) {
    return res
      .status(404)
      .json(new ApiError(404, "User not found/ approved / active"));
  }

  if (
    req.user.mobileNumber !== resUser.mobileNumber ||
    req.user.mobileNumber !== transaction.resPhone
  ) {
    return res
      .status(401)
      .json(
        new ApiError(401, "You are not authorized to approve this transaction")
      );
  }

  if (resUser.balance < transaction.amount) {
    return res
      .status(500)
      .json(
        new ApiError(500, "You don't have sufficient balance to transfer!")
      );
  }

  // Approve the transaction
  try {
    transaction.isPending = false;
    await transaction.save();
    reqUser.balance = reqUser.balance + transaction.amount;
    await reqUser.save();
    resUser.balance = resUser.balance - transaction.amount;
    await resUser.save();
  } catch (error) {
    return res.status(500).json(new ApiError(500, error.message));
  }

  // Send response
  res
    .status(200)
    .json(
      new ApiResponse(200, transaction, "Transaction approved successfully")
    );
});

// Get Transactions

const getTransaction = asyncHandler(async (req, res) => {
  let user = req.body;

  if (!user || !user.mobileNumber || !user.type) {
    user = req.user;
    if (!user || !user.mobileNumber || !user.type) {
      return res.status(404).json(new ApiError(404, "Account not found!"));
    }
  }
  // console.log(user);
  const { mobileNumber, type } = user;

  let pipeline = [];

  if (type === "User") {
    pipeline = [
      {
        $match: {
          isPending: false,
        },
      },
    ];
  }

  if (type !== "Admin") {
    pipeline = [
      ...pipeline,
      {
        $match: {
          $or: [
            {
              reqPhone: mobileNumber,
            },
            {
              resPhone: mobileNumber,
            },
          ],
        },
      },
      {
        $limit: type === "User" ? 10 : 20,
      },
    ];
  }

  const tranctions = await Transaction.aggregate(pipeline);

  if (!tranctions) {
    return res.status(501).json(new ApiError(501, "Can't get the transactions!!"));
  }

  if (tranctions.length < 1) {
    return res.status(404).json(new ApiError(404, "You don't have any transactions"));
  }

  return res.status(200).send(new ApiResponse(200, tranctions));
});

export { sendMoney, cashOut, cashIn, cashInApproval, getTransaction };

// OmegaofTs
// APK free downloader
// chat ingocnito bot
