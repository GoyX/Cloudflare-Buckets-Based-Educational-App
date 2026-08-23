const crypto = require("crypto");
const SessionGroup = require("../models/session.js");
const Block = require("../models/block.js");

// Regular users get exactly this many concurrent sessions — logging in
// somewhere new immediately ends whichever of their older sessions no
// longer fits. Admins, and any user an admin has explicitly marked
// exempt (see admin.controllers.js), are unrestricted, since they may
// legitimately need several devices at once to manage the site.
const MAX_SESSIONS = 1;

const DEVICE_COOKIE = "deviceId";
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

// A lightweight, non-invasive device identifier: a random value in its
// own long-lived cookie, separate from the auth cookie, so it survives
// login/logout cycles and lets us recognise "this same browser came
// back" without any invasive fingerprinting. Like any cookie, a
// determined user can clear it to appear as a "new" device — that's an
// inherent limit of this approach, not a bug. It's the account-level
// session cap and IP blocking together with this that make casual
// sharing impractical; nothing client-side is ever unbeatable.
const getOrCreateDeviceId = (req, res) => {
  let deviceId = req.cookies && req.cookies[DEVICE_COOKIE];
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    res.cookie(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: DEVICE_COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return deviceId;
};

// Real client IP behind Render's reverse proxy — requires `trust proxy`
// to be set in app.js, otherwise every visitor would resolve to the
// proxy's own address and IP blocking would be meaningless (or worse,
// would block everyone at once).
const getClientIp = (req) => (req.ip ? req.ip : req.connection && req.connection.remoteAddress ? req.connection.remoteAddress : "");

const isBlocked = async ({ ip, deviceId }) => {
  const orConditions = [];
  if (ip) orConditions.push({ type: "ip", value: ip });
  if (deviceId) orConditions.push({ type: "device", value: deviceId });
  if (orConditions.length === 0) return false;

  const hit = await Block.findOne({ $or: orConditions });
  return !!hit;
};

// Creates a new session for a successful login.
//
// Non-exempt users: $push with $each + $slice is a single atomic
// operation — MongoDB appends the new session and trims the array down
// to the last MAX_SESSIONS entries as one indivisible write. This is
// deliberately NOT "read the current sessions, decide what to delete,
// then delete it" — that pattern was tested under concurrent logins for
// the same user and found to race: two logins landing close together
// could each read a snapshot that doesn't yet include the other's write,
// and both cleanup steps proceeding from stale information could leave
// the user with zero sessions, or occasionally more than one. Letting
// MongoDB perform the append-and-trim as a single operation against a
// single document removes that window entirely — concurrent writes to
// the same document are serialized by the database itself, and whichever
// $slice applies last always leaves exactly MAX_SESSIONS entries,
// regardless of how many logins raced to get there.
//
// Exempt users: sessions just accumulate (no $slice trimming) — an
// unbounded array isn't a real concern here since exempt users are
// admins or a small, deliberately-chosen set of excused accounts, not
// the general user base.
const createSession = async ({ userId, ip, deviceId, userAgent, exempt }) => {
  const sessionId = crypto.randomUUID();
  const entry = {
    sessionId,
    ip,
    deviceId,
    userAgent,
    createdAt: new Date(),
    lastSeenAt: new Date(),
  };

  const pushClause = exempt ? entry : { $each: [entry], $slice: -MAX_SESSIONS };

  await SessionGroup.updateOne(
    { userId },
    { $push: { sessions: pushClause } },
    { upsert: true },
  );

  return sessionId;
};

// Checked on every authenticated request. Returns the session sub-object
// if it's still valid, or null if it's been superseded by a newer login,
// explicitly revoked, or its IP/device has since been blocked — blocking
// takes effect immediately this way, not just on the next login attempt.
// Sessions aren't given their own expiry here; they're naturally bounded
// by the JWT's own 7-day expiry (auth.controllers.js) rejecting the
// token before this is ever reached.
//
// Throws (rather than returning null) on a genuine infrastructure error
// (e.g. the DB being briefly unreachable) — callers are expected to fail
// open on a thrown error and fail closed on a null result; see the
// comments in utils/jwt.js for why that distinction matters.
const validateSession = async (sessionId, currentIp) => {
  if (!sessionId) return null;

  const group = await SessionGroup.findOne({ "sessions.sessionId": sessionId });
  if (!group) return null;

  const session = group.sessions.find((s) => s.sessionId === sessionId);
  if (!session) return null; // shouldn't happen given the query above, but defensive

  const blocked = await isBlocked({ ip: currentIp, deviceId: session.deviceId });
  if (blocked) {
    await SessionGroup.updateOne(
      { userId: group.userId },
      { $pull: { sessions: { sessionId } } },
    );
    return null;
  }

  // Throttled — only writes if this session hasn't been marked "seen" in
  // the last 5 minutes, so a busy user doesn't generate a database write
  // on literally every request. Fire-and-forget: this is a nice-to-have
  // for admin visibility, not something worth ever failing or slowing
  // down a request over.
  const FIVE_MIN = 5 * 60 * 1000;
  if (Date.now() - new Date(session.lastSeenAt).getTime() > FIVE_MIN) {
    SessionGroup.updateOne(
      { userId: group.userId, "sessions.sessionId": sessionId },
      { $set: { "sessions.$.lastSeenAt": new Date() } },
    ).catch((err) => {
      console.error("Session lastSeenAt update failed:", err);
    });
  }

  return session;
};

const revokeSession = async (sessionId) => {
  await SessionGroup.updateOne(
    { "sessions.sessionId": sessionId },
    { $pull: { sessions: { sessionId } } },
  );
};

const revokeAllSessions = async (userId) => {
  await SessionGroup.updateOne({ userId }, { $set: { sessions: [] } });
};

const getActiveSessions = async (userId) => {
  const group = await SessionGroup.findOne({ userId });
  if (!group) return [];
  return group.sessions.slice().sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt));
};

module.exports = {
  MAX_SESSIONS,
  getOrCreateDeviceId,
  getClientIp,
  isBlocked,
  createSession,
  validateSession,
  revokeSession,
  revokeAllSessions,
  getActiveSessions,
};
