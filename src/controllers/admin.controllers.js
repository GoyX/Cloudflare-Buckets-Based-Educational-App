const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const connectDB = require("../utils/db.js");
const Course = require("../models/course.js");
const User = require("../models/user.js");
const sessionManager = require("../utils/sessionManager.js");

const dashboardGET = async (req, res) => {
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

    const courses = await Course.find({}, "title students");
    return res.render("dashboard", {
      css: "dashboard.css",
      courses,
      user: req.user,
      foundUser: null,
      error: null,
    });
  } catch (error) {
    console.error("dashboardGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل لوحة التحكم",
      back: "/",
      user: req.user,
    });
  }
};

const dashboardPOST = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/dashboard",
        user: req.user,
      });
    }

    const { userId } = req.body;
    if (!userId || isNaN(Number(userId))) {
      const courses = await Course.find({}, "title students");
      return res.render("dashboard", {
        css: "dashboard.css",
        courses,
        user: req.user,
        foundUser: null,
        error: "رقم المستخدم غير صالح",
      });
    }

    const foundUser = await User.findOne(
      { userId: Number(userId) },
      "userName email userId admin verified courses",
    );
    const courses = await Course.find({}, "title students");

    return res.render("dashboard", {
      css: "dashboard.css",
      courses,
      user: req.user,
      foundUser: foundUser || null,
      error: foundUser ? null : "لا يوجد مستخدم بهذا الرقم",
    });
  } catch (error) {
    console.error("dashboardPOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل البحث",
      back: "/dashboard",
      user: req.user,
    });
  }
};

const addCourseGET = (req, res) => {
  return res.render("addCourse", {
    css: "addCourse.css",
    user: req.user,
    errors: null,
    error: null,
  });
};

const addCoursePOST = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render("addCourse", {
      css: "addCourse.css",
      user: req.user,
      errors: errors.array(),
      error: null,
    });
  }

  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/admin/add-course",
        user: req.user,
      });
    }

    if (!req.file) {
      return res.render("addCourse", {
        css: "addCourse.css",
        user: req.user,
        errors: null,
        error: "يرجى رفع صورة مصغرة للكورس",
      });
    }

    const { title, description, price, lang, hours, learnPoint } = req.body;

    let chapterTitle = req.body.chapterTitle || [];
    let videoTitle = req.body.videoTitle || [];
    let videoIdList = req.body.videoId || [];
    let keyHexList = req.body.keyHex || [];
    let durationList = req.body.durationSeconds || [];
    let qualitiesJsonList = req.body.qualitiesJson || [];
    let videoChapter = req.body.videoChapter || [];

    if (!Array.isArray(chapterTitle)) chapterTitle = [chapterTitle];
    if (!Array.isArray(videoTitle)) videoTitle = [videoTitle];
    if (!Array.isArray(videoIdList)) videoIdList = [videoIdList];
    if (!Array.isArray(keyHexList)) keyHexList = [keyHexList];
    if (!Array.isArray(durationList)) durationList = [durationList];
    if (!Array.isArray(qualitiesJsonList))
      qualitiesJsonList = [qualitiesJsonList];
    if (!Array.isArray(videoChapter)) videoChapter = [videoChapter];

    if (chapterTitle.length === 0) {
      return res.render("addCourse", {
        css: "addCourse.css",
        user: req.user,
        errors: null,
        error: "يجب إضافة فصل واحد على الأقل",
      });
    }

    if (
      videoTitle.length !== videoIdList.length ||
      videoTitle.length !== keyHexList.length ||
      videoTitle.length !== durationList.length ||
      videoTitle.length !== qualitiesJsonList.length
    ) {
      return res.render("addCourse", {
        css: "addCourse.css",
        user: req.user,
        errors: null,
        error:
          "بيانات الفيديوهات غير مكتملة — تأكد من اكتمال رفع جميع الفيديوهات قبل الحفظ",
      });
    }

    const chapters = chapterTitle.map((title, i) => ({
      chapTitle: title,
      videos: [],
    }));

    for (let i = 0; i < videoTitle.length; i++) {
      const chIdx = parseInt(videoChapter[i], 10);
      if (isNaN(chIdx) || chIdx < 0 || chIdx >= chapters.length) {
        continue;
      }

      let qualities;
      try {
        qualities = JSON.parse(qualitiesJsonList[i]);
      } catch {
        return res.render("addCourse", {
          css: "addCourse.css",
          user: req.user,
          errors: null,
          error: `بيانات الجودة غير صالحة للفيديو: ${videoTitle[i]}`,
        });
      }

      chapters[chIdx].videos.push({
        title: videoTitle[i],
        videoId: videoIdList[i],
        keyHex: (keyHexList[i] || "").toLowerCase(),
        durationSeconds: parseFloat(durationList[i]) || 0,
        qualities,
      });
    }

    let learnPoints = learnPoint || [];
    if (!Array.isArray(learnPoints)) learnPoints = [learnPoints];

    const newCourse = new Course({
      title,
      description,
      price: parseFloat(price),
      lang,
      hours: parseFloat(hours),
      learnPoint: learnPoints,
      thumbnail: req.file.filename,
      lecturesNumber: videoTitle.length,
      chapters,
    });

    await newCourse.save();
    return res.redirect("/admin/courses");
  } catch (error) {
    console.error("addCoursePOST error:", error);
    return res.render("addCourse", {
      css: "addCourse.css",
      user: req.user,
      errors: null,
      error: "فشل إضافة الكورس، أعد المحاولة",
    });
  }
};

const manageCoursesGET = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/dashboard",
        user: req.user,
      });
    }

    const courses = await Course.find({}, "title thumbnail students price");
    return res.render("manageCourses", {
      css: "manageCourses.css",
      courses,
      user: req.user,
    });
  } catch (error) {
    console.error("manageCoursesGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل الكورسات",
      back: "/dashboard",
      user: req.user,
    });
  }
};

const deleteCoursePOST = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/admin/courses",
        user: req.user,
      });
    }

    const { courseId } = req.params;
    if (!mongoose.isValidObjectId(courseId)) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: "/admin/courses",
        user: req.user,
      });
    }

    await Course.findByIdAndDelete(courseId);

    await User.updateMany(
      { courses: courseId },
      { $pull: { courses: new mongoose.Types.ObjectId(courseId) } },
    );

    return res.redirect("/admin/courses");
  } catch (error) {
    console.error("deleteCoursePOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل حذف الكورس",
      back: "/admin/courses",
      user: req.user,
    });
  }
};

const userManageGET = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/dashboard",
        user: req.user,
      });
    }

    const { userId } = req.params;

    const targetUser = await User.findOne({ userId: Number(userId) });
    if (!targetUser) {
      return res.render("error", {
        css: "error.css",
        error: "المستخدم غير موجود",
        back: "/dashboard",
        user: req.user,
      });
    }

    const allCourses = await Course.find({}, "title thumbnail");

    const ownedCourseIds = new Set(
      targetUser.courses.map((id) => id.toString()),
    );

    const activeSessions = await sessionManager.getActiveSessions(targetUser._id);

    return res.render("userManage", {
      css: "userManage.css",
      userM: targetUser,
      courses: allCourses,
      ownedCourseIds,
      activeSessions,
      user: req.user,
      error: null,
      note: null,
    });
  } catch (error) {
    console.error("userManageGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل بيانات المستخدم",
      back: "/dashboard",
      user: req.user,
      userOwns: null,
    });
  }
};

const userManagePOST = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/dashboard",
        user: req.user,
        userOwns: null,
      });
    }

    const { userId } = req.params;
    const { courseId, action } = req.body;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: `/admin/manage/${userId}`,
        user: req.user,
      });
    }

    const targetUser = await User.findOne({ userId: Number(userId) });
    if (!targetUser) {
      return res.render("error", {
        css: "error.css",
        error: "المستخدم غير موجود",
        back: "/dashboard",
        user: req.user,
      });
    }

    const courseObjectId = new mongoose.Types.ObjectId(courseId);

    if (action === "add") {
      await User.findByIdAndUpdate(targetUser._id, {
        $addToSet: { courses: courseObjectId },
      });
      await Course.findByIdAndUpdate(courseId, { $inc: { students: 1 } });
    } else if (action === "remove") {
      await User.findByIdAndUpdate(targetUser._id, {
        $pull: { courses: courseObjectId },
      });
      await Course.findByIdAndUpdate(courseId, {
        $inc: { students: -1 },
      });
    }

    return res.redirect(`/admin/manage/${userId}`);
  } catch (error) {
    console.error("userManagePOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل تحديث بيانات المستخدم",
      back: `/admin/manage/${req.params.userId}`,
      user: req.user,
      userOwns: null,
    });
  }
};

const toggleSessionExemptPOST = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/dashboard",
        user: req.user,
      });
    }

    const { userId } = req.params;
    const targetUser = await User.findOne({ userId: Number(userId) });
    if (!targetUser) {
      return res.render("error", {
        css: "error.css",
        error: "المستخدم غير موجود",
        back: "/dashboard",
        user: req.user,
      });
    }

    targetUser.sessionLimitExempt = !targetUser.sessionLimitExempt;
    await targetUser.save();

    return res.redirect(`/admin/manage/${userId}`);
  } catch (error) {
    console.error("toggleSessionExemptPOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل تحديث إعدادات الجلسة",
      back: `/admin/manage/${req.params.userId}`,
      user: req.user,
    });
  }
};

const revokeSessionPOST = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/dashboard",
        user: req.user,
      });
    }

    const { userId, sessionId } = req.params;
    await sessionManager.revokeSession(sessionId);

    return res.redirect(`/admin/manage/${userId}`);
  } catch (error) {
    console.error("revokeSessionPOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل إنهاء الجلسة",
      back: `/admin/manage/${req.params.userId}`,
      user: req.user,
    });
  }
};

module.exports = {
  dashboardGET,
  dashboardPOST,
  addCourseGET,
  addCoursePOST,
  manageCoursesGET,
  deleteCoursePOST,
  userManageGET,
  userManagePOST,
  toggleSessionExemptPOST,
  revokeSessionPOST,
};
