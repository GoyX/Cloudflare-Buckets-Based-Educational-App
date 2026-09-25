const connectDB = require("../utils/db.js");
const Block = require("../models/block.js");
const User = require("../models/user.js");

const securityGET = async (req, res) => {
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

    const blocks = await Block.find({}).sort({ createdAt: -1 });

    return res.render("security", {
      css: "security.css",
      blocks,
      user: req.user,
      error: null,
    });
  } catch (error) {
    console.error("securityGET error:", error);
    return res.render("error", {
      css: "error.css",
      error: "تعذّر تحميل قائمة الحظر",
      back: "/dashboard",
      user: req.user,
    });
  }
};

const blockPOST = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/admin/security",
        user: req.user,
      });
    }

    const { type, value, reason } = req.body;
    if (type !== "ip" && type !== "device") {
      return res.render("error", {
        css: "error.css",
        error: "نوع الحظر غير صالح",
        back: "/admin/security",
        user: req.user,
      });
    }
    if (typeof value !== "string" || value.trim().length === 0) {
      return res.render("error", {
        css: "error.css",
        error: "القيمة المطلوب حظرها غير صالحة",
        back: "/admin/security",
        user: req.user,
      });
    }

    const adminDoc = req.user ? await User.findOne({ email: req.user.data }, "_id") : null;

    await Block.updateOne(
      { type, value: value.trim() },
      {
        $setOnInsert: {
          type,
          value: value.trim(),
          reason: (reason || "").trim(),
          blockedBy: adminDoc ? adminDoc._id : undefined,
        },
      },
      { upsert: true },
    );

    return res.redirect("/admin/security");
  } catch (error) {
    console.error("blockPOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل إضافة الحظر",
      back: "/admin/security",
      user: req.user,
    });
  }
};

const unblockPOST = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/admin/security",
        user: req.user,
      });
    }

    const { blockId } = req.params;
    await Block.findByIdAndDelete(blockId);

    return res.redirect("/admin/security");
  } catch (error) {
    console.error("unblockPOST error:", error);
    return res.render("error", {
      css: "error.css",
      error: "فشل إلغاء الحظر",
      back: "/admin/security",
      user: req.user,
    });
  }
};

module.exports = { securityGET, blockPOST, unblockPOST };
