const mongoose = require("mongoose");

// One document per USER (not per session) — each user's active sessions
// live as an array on their own document. This is deliberate, not
// incidental: MongoDB's $push + $slice is a single atomic operation at
// the database level, so "add this new session, then trim down to the
// last MAX_SESSIONS" happens as one indivisible step per write. Modeling
// this instead as separate documents (one per session, with the
// application reading the current top-N and then deciding what to
// delete) was tried and rejected — under concurrent logins for the same
// user, that read-then-decide-then-delete pattern can race and leave
// anywhere from 0 to several sessions standing, since each concurrent
// login's cleanup step can end up deleting sessions that a DIFFERENT
// concurrent login just created. The atomic array-update approach here
// has no such window: MongoDB serializes writes to the same document,
// and the last $slice to apply always wins and always converges to
// exactly MAX_SESSIONS (see utils/sessionManager.js).
const sessionEntrySchema = new mongoose.Schema(
  {
    // Random UUID embedded in the JWT payload at login (see
    // auth.controllers.js) — what a request's token gets checked
    // against on every subsequent request.
    sessionId: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      trim: true,
    },
    // Long-lived random cookie value, separate from the auth cookie —
    // see utils/sessionManager.js for why this (and not just the
    // User-Agent string) is used to recognise "the same browser came
    // back".
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

// Lets validateSession() look up "which user's session group contains
// this sessionId" directly, without already knowing the userId — that's
// all the JWT payload carries (see auth.controllers.js).
sessionGroupSchema.index({ "sessions.sessionId": 1 });

module.exports = mongoose.model("SessionGroup", sessionGroupSchema);
