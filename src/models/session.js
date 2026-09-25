const mongoose = require("mongoose");

const sessionEntrySchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      trim: true,
    },
    deviceId: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const sessionGroupSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  sessions: {
    type: [sessionEntrySchema],
    default: [],
  },
});

sessionGroupSchema.index({ "sessions.sessionId": 1 });

module.exports = mongoose.model("SessionGroup", sessionGroupSchema);
