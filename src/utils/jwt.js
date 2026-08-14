const jwt = require("jsonwebtoken");
const User = require("../models/user.js");
const connectDB = require("./db.js");

const isAuth = async (req, res, next) => {
  try {
    const token = req.cookies.toJtkn;
    if (!token) {
      return res.redirect("/login");
    }

    jwt.verify(token, process.env.PRIVATE_KEY, (err, data) => {
      if (err) {
        res.clearCookie("toJtkn");
        return res.redirect("/login");
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

    jwt.verify(token, process.env.PRIVATE_KEY, (err, data) => {
      if (err) {
        res.clearCookie("toJtkn");
        req.user = null;
        return next();
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
    jwt.verify(token, process.env.PRIVATE_KEY, (err) => {
      if (err) {
        res.clearCookie("toJtkn");
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

    jwt.verify(token, process.env.PRIVATE_KEY, (err, data) => {
      if (err) {
        return res.sendStatus(401);
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
