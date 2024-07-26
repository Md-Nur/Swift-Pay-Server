import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  reqPhone: {
    type: String,
    required: true,
    ref: "User",
    trim: true,
  },
  resPhone: {
    type: String,
    required: true,
    ref: "User",
    trim: true,
  },
  method: {
    type: String,
    enum: ["cashIn", "cashOut", "sendMoney"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  fee: {
    type: Number,
    required: true,
  },
  isPending: {
    type: Boolean,
    default: true,
  },
});

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
