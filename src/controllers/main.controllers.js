const connectDB = require("../utils/db.js");
const Course = require("../models/course.js");
const User = require("../models/user.js");
const Counter = require("../models/counter.js");

const homeGET = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/",
        user: req.user,
      });
    }

    const courses = await Course.find(
      {},
      "_id title description price thumbnail lang hours students",
    );
    const counterDoc = await Counter.findOne({});
    const visitorCount = counterDoc ? counterDoc.count : 0;

    return res.render("home", {
      css: "home.css",
      courses,
      visitorCount,
      user: req.user,
    });
  } catch (error) {
    console.error("homeGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل الصفحة الرئيسية",
      back: "/",
      user: req.user,
    });
  }
};

const offlineGET = async (req, res) => {
  try {
    return res.render("offline", {
      css: "home.css",
    });
  } catch (error) {
    console.error("offlineGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل الصفحة ",
      back: "/",
      user: req.user,
    });
  }
};

const userProfileGET = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/",
        user: req.user,
      });
    }

    const userDoc = await User.findOne({ email: req.user.data });
    if (!userDoc) {
      return res.render("error", {
        css: "error.css",
        error: "المستخدم غير موجود",
        back: "/",
        user: req.user,
      });
    }

    const ownedCourses = await Course.find(
      { _id: { $in: userDoc.courses } },
      "title thumbnail chapters",
    );
    const validCourses = ownedCourses.filter(Boolean);

    return res.render("userProfile", {
      css: "userProfile.css",
      userM: userDoc,
      courses: validCourses,
      user: req.user,
    });
  } catch (error) {
    console.error("userProfileGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل الملف الشخصي",
      back: "/",
      user: req.user,
    });
  }
};

module.exports = { homeGET, userProfileGET, offlineGET };
