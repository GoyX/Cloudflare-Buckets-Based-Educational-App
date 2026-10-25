const mongoose = require("mongoose");

const CONNECT_OPTIONS = {
  // How long to wait for a reachable server before giving up on a
  // connect attempt or an operation that needs a server.
  serverSelectionTimeoutMS: 10000,

  // Kills an operation whose socket goes silent for this long. Without
  // it (the driver default is "never") a connection that dies without
  // telling anyone — a NAT/load-balancer silently dropping an idle
  // socket is the classic cause — leaves the operation waiting forever
  // instead of failing, which is exactly what a request that never
  // gets a response looks like from the browser.
  socketTimeoutMS: 20000,

  // Bounds how long an operation waits for a free pooled connection.
  // The driver default is "forever", so one batch of stuck operations
  // could otherwise queue every later request behind them indefinitely.
  waitQueueTimeoutMS: 10000,

  // Retire pooled connections that have sat idle this long, so a
  // connection a middlebox has silently dropped while idle is never the
  // one handed to the next request after a quiet period.
  maxIdleTimeMS: 60000,
};

// How long to let the driver's own automatic reconnection work before
// concluding the connection is genuinely gone and rebuilding it.
const RECOVERY_GRACE_MS = 3000;

let hasConnectedBefore = false;
let connectPromise = null;

const waitForReady = (timeoutMs) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const poll = () => {
      if (mongoose.connection.readyState === 1) return resolve(true);
      if (Date.now() - startedAt >= timeoutMs) return resolve(false);
      setTimeout(poll, 100);
    };
    poll();
  });

const establishConnection = async () => {
  if (hasConnectedBefore) {
    // The connection existed and has dropped. The driver normally
    // reconnects on its own within moments, so give it that chance
    // first rather than tearing down a connection that's about to heal.
    if (await waitForReady(RECOVERY_GRACE_MS)) return mongoose.connection;

    // Still down: discard the dead client so the fresh connect below
    // doesn't leave an orphaned one behind.
    try {
      await mongoose.disconnect();
    } catch (error) {
      console.error("MongoDB disconnect before reconnect failed:", error);
    }
  }

  const conn = await mongoose.connect(process.env.MONGO_URI, CONNECT_OPTIONS);
  hasConnectedBefore = true;
  console.log("Connected to DB . .");
  return conn;
};

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectPromise) {
    connectPromise = establishConnection()
      .catch((error) => {
        console.error("MongoDB connection error:", error);
        return null;
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  return connectPromise;
};

module.exports = connectDB;