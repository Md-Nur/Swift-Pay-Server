import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import User from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    // console.log("accessToken: ", accessToken);
    return { accessToken, refreshToken };
  } catch (error) {
    res
      .status(500)
      .json(
        new ApiError(
          500,
          "Something went wrong while generating referesh and access token"
        )
      );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  let { name, pin, mobileNumber, email, type } = req.body;
  // console.log("email: ", email);

  // validation - not empty fields
  if (pin < 10000 || pin > 99999) {
    return res.status(400).json(new ApiError(400, "Pin must be 5 digits"));
  } else {
    pin = pin.toString();
  }
  if (
    [name, pin, mobileNumber, email, type].find(
      (field) => field?.toString()?.trim() === ""
    )
  ) {
    return res.status(400).json(new ApiError(400, "All fields are required"));
  }

  // check if user already exists: mobile number, email
  const existedUser = await User.findOne({
    $or: [{ mobileNumber }, { email }],
  });

  if (existedUser) {
    return res
      .status(409)
      .json(
        new ApiError(409, "User with email or phone Number already exists")
      );
  }

  // create user object - create entry in db
  const user = await User.create({
    name,
    pin,
    mobileNumber,
    email,
    isApproved: false,
    accountStatus: "Active",
    type,
    balance: 0,
  });

  // remove pin and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-pin -refreshToken"
  );

  // check for user creation
  if (!createdUser) {
    res
      .status(500)
      .json(
        new ApiError(500, "Something went wrong while registering the user")
      );
  }

  // return res
  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        createdUser,
        "Success! You can use swift pay after approval"
      )
    );
});

const loginUser = asyncHandler(async (req, res) => {
  //send cookie

  // req body -> data
  const { phoneEmail, pin } = req.body;

  // check the fields is not empty
  if (!phoneEmail && !email) {
    return res
      .status(400)
      .json(new ApiError(400, "username or email is required"));
  }

  //find the user
  const user = await User.findOne({
    $or: [{ mobileNumber: phoneEmail }, { email: phoneEmail }],
  });

  if (!user) {
    return res.status(404).json(new ApiError(404, "User does not exist"));
  }

  //pin check
  const isPinValid = await user.isPinCorrect(pin);
  if (!isPinValid) {
    return res.status(401).json(new ApiError(401, "Invalid user credentials"));
  }

  // Check the user is approved or block
  if (!user.isApproved || user.accountStatus === "Blocked") {
    res
      .status(401)
      .json(new ApiError(401, "You are not approved / blocked by admin"));
  }

  //access and referesh token
  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );

  if (!accessToken || !refreshToken) {
    return res
      .status(500)
      .json(new ApiError(500, "Something went wrong while generating tokens"));
  }

  const loggedInUser = await User.findById(user._id).select(
    "-pin -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    return res.status(401).json(new ApiError(401, "unauthorized request"));
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      return res.status(401).json(new ApiError(401, "Invalid refresh token"));
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      res
        .status(401)
        .json(new ApiError(401, "Refresh token is expired or used"));
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefereshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    res
      .status(401)
      .json(new ApiError(401, error?.message || "Invalid refresh token"));
  }
});

const getAllUsers = asyncHandler(async (req, res) => {
  if (req.user.type !== "Admin") {
    return res.status(403).json(new ApiError(403, "Permission denied"));
  }
  const users = await User.find({}).select("-pin -refreshToken").sort("-_id");
  console.log(users);
  return res
    .status(200)
    .json(new ApiResponse(200, users, "Users fetched successfully"));
});

const userApporval = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  if (!userId) {
    return res.status(400).json(new ApiError(400, "All fields are required"));
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json(new ApiError(404, "User not found"));
  }
  user.isApproved = true;
  user.balance = user.type === "Agent" ? 10000 : 40;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User approval status updated"));
});

const changeCurrentPin = asyncHandler(async (req, res) => {
  const { oldPin, newPin } = req.body;

  const user = await User.findById(req.user?._id);
  const isPinCorrect = await user.isPinCorrect(oldPin);

  if (!isPinCorrect) {
    return res.status(400).json(new ApiError(400, "Invalid old pin"));
  }

  user.pin = newPin;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "pin changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { accountStatus } = req.body;
  const id = req.params.id;

  if (!accountStatus || !id) {
    return res.status(400).json(new ApiError(400, "All fields are required"));
  }

  const user = await User.findByIdAndUpdate(
    id,
    {
      $set: {
        accountStatus,
      },
    },
    { new: true }
  ).select("-pin");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPin,
  getCurrentUser,
  updateAccountDetails,
  getAllUsers,
  userApporval,
};
