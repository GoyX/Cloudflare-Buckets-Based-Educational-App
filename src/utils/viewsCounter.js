const Counter = require("../models/counter.js");

const count = async (req, res, next) => {
  if (req.method === "GET" && !req.path.match(/\.[a-z0-9]+$/i)) {
    try {
      await Counter.findOneAndUpdate(
        {},
        { $inc: { count: 1 } },
        { upsert: true, new: true },
      );
    } catch (err) {
      console.error("viewsCounter error:", err);
    }
  }
  next();
};

module.exports = { count };
