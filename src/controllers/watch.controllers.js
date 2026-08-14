const mongoose = require("mongoose");
const connectDB = require("../utils/db.js");
const Course = require("../models/course.js");
const User = require("../models/user.js");

const watchGET = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/courses",
        user: req.user,
      });
    }

    const { courseId } = req.params;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: "/courses",
        user: req.user,
      });
    }

    const userDoc = await User.findOne({ email: req.user.data }, "courses");
    if (!userDoc) {
      return res.render("error", {
        css: "error.css",
        error: "المستخدم غير موجود",
        back: "/courses",
        user: req.user,
      });
    }

    const ownsThisCourse = userDoc.courses.some(
      (id) => id.toString() === courseId,
    );
    if (!ownsThisCourse) {
      return res.redirect(`/course/${courseId}`);
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: "/courses",
        user: req.user,
      });
    }

    let currentVideo = null;
    let currentChapter = null;

    const { videoId } = req.params;

    if (videoId) {
      if (!mongoose.isValidObjectId(videoId)) {
        return res.render("error", {
          css: "error.css",
          error: "الفيديو غير موجود",
          back: `/watch/${courseId}`,
          user: req.user,
        });
      }

      for (const chapter of course.chapters) {
        const found = chapter.videos.find((v) => v._id.toString() === videoId);
        if (found) {
          currentVideo = found;
          currentChapter = chapter;
          break;
        }
      }

      if (!currentVideo) {
        return res.render("error", {
          css: "error.css",
          error: "الفيديو غير موجود في هذا الكورس",
          back: `/watch/${courseId}`,
          user: req.user,
        });
      }
    } else {
      if (course.chapters.length > 0 && course.chapters[0].videos.length > 0) {
        currentChapter = course.chapters[0];
        currentVideo = course.chapters[0].videos[0];
      }
    }

    return res.render("watch", {
      css: "watch.css",
      course,
      currentVideo,
      currentChapter,
      user: req.user,
    });
  } catch (error) {
    console.error("watchGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل الفيديو",
      back: "/courses",
      user: req.user,
    });
  }
};

module.exports = { watchGET };
