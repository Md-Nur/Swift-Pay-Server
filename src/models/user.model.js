import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv/config.js";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required!"],
      unique: true,
      trim: true,
    },
    pin: {
      type: String,
      required: [true, "Pin is required"],
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    accountStatus: {
      type: String,
      default: "Active",
      enum: ["Active", "Blocked"],
    },
    type: {
      type: String,
      enum: ["User", "Admin", "Agent"],
      required: [true, "Account Type is requierd"],
    },
    balance: {
      type: Number,
      default: 0,
    },
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("pin")) return next();

  this.pin = await bcrypt.hash(this.pin, 10);
  next();
});

userSchema.methods.isPinCorrect = async function (pin) {
  return await bcrypt.compare(pin, this.pin);
};

userSchema.methods.generateAccessToken = function () {
  const token = jwt.sign(
    {
      _id: this._id,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
  // console.log("token", token);
  return token;
};
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

const User = mongoose.model("User", userSchema);

export default User;
