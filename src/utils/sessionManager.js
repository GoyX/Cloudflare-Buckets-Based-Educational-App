const crypto = require("crypto");
const SessionGroup = require("../models/session.js");
const Block = require("../models/block.js");

const MAX_SESSIONS = 1;

const DEVICE_COOKIE = "deviceId";
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; 

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

const getClientIp = (req) => (req.ip ? req.ip : req.connection && req.connection.remoteAddress ? req.connection.remoteAddress : "");

const isBlocked = async ({ ip, deviceId }) => {
  const orConditions = [];
  if (ip) orConditions.push({ type: "ip", value: ip });
  if (deviceId) orConditions.push({ type: "device", value: deviceId });
  if (orConditions.length === 0) return false;

  const hit = await Block.findOne({ $or: orConditions });
  return !!hit;
};

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
