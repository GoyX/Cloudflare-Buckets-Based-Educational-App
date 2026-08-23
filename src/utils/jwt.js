const jwt = require("jsonwebtoken");
const User = require("../models/user.js");
const connectDB = require("./db.js");
const sessionManager = require("./sessionManager.js");

// A note that applies to every function below that now calls
// sessionManager.validateSession(): it can resolve two different ways,
// and each is handled deliberately differently.
//
//   - It returns null: the JWT's signature is valid, but its session was
//     explicitly ended (a newer login elsewhere, an admin revoking it, or
//     its IP/device getting blocked). This is the actual feature working
//     as intended — fail CLOSED, treat the user as logged out.
//   - It throws: something went wrong reaching the database itself (a
//     connectivity blip, a timeout). This is an infrastructure problem,
//     not a security decision — fail OPEN, let the request through on
//     the JWT's signature alone, exactly like this app always did before
//     session tracking existed. Doing anything else would mean a single
//     brief database hiccup force-logs-out every single visitor at once,
//     including on the highest-frequency route in the app
//     (/stream/*, once per video segment).

const isAuth = async (req, res, next) => {
  try {
    const token = req.cookies.toJtkn;
    if (!token) {
      return res.redirect("/login");
    }

    jwt.verify(token, process.env.PRIVATE_KEY, async (err, data) => {
      if (err) {
        res.clearCookie("toJtkn");
        return res.redirect("/login");
      }

      try {
        const session = await sessionManager.validateSession(
          data.sessionId,
          sessionManager.getClientIp(req),
        );
        if (!session) {
          res.clearCookie("toJtkn");
          return res.redirect("/login");
        }
      } catch (dbError) {
        console.error("isAuth session check failed, failing open:", dbError);
      }

      req.user = data;
      next();
    });
  } catch (error) {
    console.error(error);
    return res.redirect("/");
  }
};

const checkAuth = async (req, res, next) => {
  try {
    const token = req.cookies.toJtkn;
    if (!token) {
      req.user = null;
      return next();
    }

    jwt.verify(token, process.env.PRIVATE_KEY, async (err, data) => {
      if (err) {
        res.clearCookie("toJtkn");
        req.user = null;
        return next();
      }

      try {
        const session = await sessionManager.validateSession(
          data.sessionId,
          sessionManager.getClientIp(req),
        );
        if (!session) {
          res.clearCookie("toJtkn");
          req.user = null;
          return next();
        }
      } catch (dbError) {
        console.error("checkAuth session check failed, failing open:", dbError);
      }

      req.user = data;
      next();
    });
  } catch (error) {
    console.error(error);
    req.user = null;
    next();
  }
};

const isNotAuth = async (req, res, next) => {
  try {
    const token = req.cookies.toJtkn;
    if (!token) {
      req.user = null;
      return next();
    }
    jwt.verify(token, process.env.PRIVATE_KEY, async (err, data) => {
      if (err) {
        res.clearCookie("toJtkn");
        req.user = null;
        return next();
      }

      try {
        const session = await sessionManager.validateSession(
          data.sessionId,
          sessionManager.getClientIp(req),
        );
        if (!session) {
          // Session was ended elsewhere — this user should be able to
          // reach the login page again, not get redirected away from it
          // as if they were still signed in.
          res.clearCookie("toJtkn");
          req.user = null;
          return next();
        }
      } catch (dbError) {
        // Can't verify either way — default to letting them see the
        // login/signup page rather than assuming they're still signed
        // in and redirecting them away from it.
        console.error("isNotAuth session check failed, failing open to 'not authenticated':", dbError);
        req.user = null;
        return next();
      }

      return res.redirect("/");
    });
  } catch (error) {
    console.error(error);
    return res.redirect("/");
  }
};

const isAuthApi = async (req, res, next) => {
  try {
    const token = req.cookies.toJtkn;
    if (!token) {
      return res.sendStatus(401);
    }

    jwt.verify(token, process.env.PRIVATE_KEY, async (err, data) => {
      if (err) {
        return res.sendStatus(401);
      }

      try {
        const session = await sessionManager.validateSession(
          data.sessionId,
          sessionManager.getClientIp(req),
        );
        if (!session) {
          return res.sendStatus(401);
        }
      } catch (dbError) {
        console.error("isAuthApi session check failed, failing open:", dbError);
      }

      req.user = data;
      next();
    });
  } catch (error) {
    console.error(error);
    return res.sendStatus(401);
  }
};

const checkAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect("/");
    }

    const connect = await connectDB();

    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/",
        user: req.user,
      });
    }

    const checkIsAdmin = await User.findOne({ email: req.user.data });
    if (!checkIsAdmin || checkIsAdmin.admin === false) {
      return res.redirect("/");
    }

    next();
  } catch (error) {
    console.error(error);
    return res.redirect("/");
  }
};

const checkAdminApi = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.sendStatus(401);
    }

    const connect = await connectDB();
    if (!connect) {
      return res.sendStatus(503);
    }

    const checkIsAdmin = await User.findOne({ email: req.user.data });
    if (!checkIsAdmin || checkIsAdmin.admin === false) {
      return res.sendStatus(403);
    }

    next();
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
};

module.exports = {
  isAuth,
  isNotAuth,
  checkAuth,
  checkAdmin,
  isAuthApi,
  checkAdminApi,
};
