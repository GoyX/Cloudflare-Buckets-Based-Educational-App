const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["ip", "device"],
      required: true,
    },
    value: {
      type: String,
      required: true,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
      maxLength: 300,
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

blockSchema.index({ type: 1, value: 1 }, { unique: true });

module.exports = mongoose.model("Block", blockSchema);
