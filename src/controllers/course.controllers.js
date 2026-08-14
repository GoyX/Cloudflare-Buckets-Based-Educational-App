const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const connectDB = require("../utils/db.js");
const Course = require("../models/course.js");
const User = require("../models/user.js");

const validateObjectId = (id) => mongoose.isValidObjectId(id);

const courseShopGET = async (req, res) => {
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
      "title description price thumbnail lang hours lecturesNumber students",
    );
    return res.render("courseShop", {
      css: "courseShop.css",
      courses,
      user: req.user,
    });
  } catch (error) {
    console.error("courseShopGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل الكورسات",
      back: "/",
      user: req.user,
    });
  }
};

const courseGET = async (req, res) => {
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
    if (!validateObjectId(courseId)) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: "/courses",
        user: req.user,
      });
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

    let userOwns = false;
    if (req.user) {
      const userDoc = await User.findOne({ email: req.user.data }, "courses");
      userOwns = userDoc
        ? userDoc.courses.some((id) => id.toString() === courseId)
        : false;
    }

    return res.render("course", {
      css: "course.css",
      course,
      user: req.user,
      userOwns,
    });
  } catch (error) {
    console.error("courseGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل الكورس",
      back: "/courses",
      user: req.user,
    });
  }
};

const coursePayment = async (req, res) => {
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
    if (!validateObjectId(courseId)) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: "/courses",
        user: req.user,
      });
    }

    const course = await Course.findById(courseId, "title price thumbnail");
    if (!course) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: "/courses",
        user: req.user,
      });
    }

    if (req.user) {
      const userDoc = await User.findOne({ email: req.user.data }, "courses");
      const alreadyOwns = userDoc
        ? userDoc.courses.some((id) => id.toString() === courseId)
        : false;

      if (alreadyOwns) {
        return res.redirect(`/watch/${courseId}`);
      }
    }

    return res.render("payment", {
      css: "payment.css",
      course,
      user: req.user,
    });
  } catch (error) {
    console.error("coursePayment error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل صفحة الدفع",
      back: "/courses",
      user: req.user,
    });
  }
};

const courseManageGET = async (req, res) => {
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
    if (!validateObjectId(courseId)) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: "/admin/courses",
        user: req.user,
      });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: "/admin/courses",
        user: req.user,
      });
    }

    return res.render("courseManage", {
      css: "courseManage.css",
      course,
      user: req.user,
    });
  } catch (error) {
    console.error("courseManageGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل إدارة الكورس",
      back: "/admin/courses",
      user: req.user,
    });
  }
};

const courseManagePOST = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const course = await Course.findById(req.params.courseId);
    return res.render("courseManage", {
      css: "courseManage.css",
      course,
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
        back: `/manage/${req.params.courseId}`,
        user: req.user,
      });
    }

    const { courseId } = req.params;
    const {
      chapterId,
      videoTitle,
      videoId,
      keyHex,
      durationSeconds,
      qualitiesJson,
    } = req.body;

    if (!validateObjectId(courseId) || !validateObjectId(chapterId)) {
      return res.render("error", {
        css: "error.css",
        error: "معرّف غير صالح",
        back: `/manage/${courseId}`,
        user: req.user,
      });
    }

    let qualities;
    try {
      qualities = JSON.parse(qualitiesJson);
    } catch {
      return res.render("error", {
        css: "error.css",
        error: "بيانات جودة الفيديو غير صالحة",
        back: `/manage/${courseId}`,
        user: req.user,
      });
    }

    const updated = await Course.findOneAndUpdate(
      { _id: courseId, "chapters._id": chapterId },
      {
        $push: {
          "chapters.$.videos": {
            title: videoTitle,
            videoId,
            keyHex: keyHex.toLowerCase(),
            durationSeconds: parseFloat(durationSeconds) || 0,
            qualities,
          },
        },
      },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.render("error", {
        css: "error.css",
        error: "الفصل أو الكورس غير موجود",
        back: `/manage/${courseId}`,
        user: req.user,
      });
    }

    return res.redirect(`/manage/${courseId}`);
  } catch (error) {
    console.error("courseManagePOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل إضافة الفيديو",
      back: `/manage/${req.params.courseId}`,
      user: req.user,
    });
  }
};

const addChapterPOST = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: `/manage/${req.params.courseId}`,
        user: req.user,
      });
    }

    const { courseId } = req.params;
    const { chapTitle } = req.body;

    if (!validateObjectId(courseId)) {
      return res.render("error", {
        css: "error.css",
        error: "الكورس غير موجود",
        back: "/admin/courses",
        user: req.user,
      });
    }

    if (!chapTitle || !chapTitle.trim()) {
      return res.redirect(`/manage/${courseId}`);
    }

    await Course.findByIdAndUpdate(courseId, {
      $push: { chapters: { chapTitle: chapTitle.trim(), videos: [] } },
    });

    return res.redirect(`/manage/${courseId}`);
  } catch (error) {
    console.error("addChapterPOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل إضافة الفصل",
      back: `/manage/${req.params.courseId}`,
      user: req.user,
    });
  }
};

const deleteVideoPOST = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: `/manage/${req.params.courseId}`,
        user: req.user,
      });
    }

    const { courseId, chapterId, videoId } = req.params;

    if (
      !validateObjectId(courseId) ||
      !validateObjectId(chapterId) ||
      !validateObjectId(videoId)
    ) {
      return res.render("error", {
        css: "error.css",
        error: "معرّف غير صالح",
        back: `/manage/${courseId}`,
        user: req.user,
      });
    }

    await Course.findOneAndUpdate(
      { _id: courseId, "chapters._id": chapterId },
      { $pull: { "chapters.$.videos": { _id: videoId } } },
    );

    return res.redirect(`/manage/${courseId}`);
  } catch (error) {
    console.error("deleteVideoPOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل حذف الفيديو",
      back: `/manage/${req.params.courseId}`,
      user: req.user,
    });
  }
};

module.exports = {
  courseShopGET,
  courseGET,
  coursePayment,
  courseManageGET,
  courseManagePOST,
  addChapterPOST,
  deleteVideoPOST,
};
