const mongoose = require("mongoose");

// A single blocklist for both IPs and devices — one entry, one type.
// Checked by utils/sessionManager.js on every login attempt AND on every
// subsequent authenticated request, so blocking someone takes effect
// immediately — it ends any session of theirs already in progress,
// rather than only stopping their next login attempt.
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

// A given IP or device can only appear on the list once.
blockSchema.index({ type: 1, value: 1 }, { unique: true });

module.exports = mongoose.model("Block", blockSchema);
