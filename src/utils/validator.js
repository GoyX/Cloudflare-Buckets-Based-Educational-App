const { body } = require("express-validator");

const requiredMsg = (field) => `حقل ${field} مطلوب`;
const minMsg = (field, n) => `${field} يجب أن يكون ${n} أحرف على الأقل`;
const maxMsg = (field, n) => `${field} يجب ألا يتجاوز ${n} حرفاً`;

const signupValidator = [
  body("userName")
    .trim()
    .notEmpty()
    .withMessage(requiredMsg("اسم المستخدم"))
    .isLength({ min: 3 })
    .withMessage(minMsg("اسم المستخدم", 3))
    .isLength({ max: 30 })
    .withMessage(maxMsg("اسم المستخدم", 30)),

  body("email")
    .trim()
    .notEmpty()
    .withMessage(requiredMsg("البريد الالكتروني"))
    .isEmail()
    .withMessage("صيغة البريد الالكتروني غير صحيحة")
    .normalizeEmail(),

  body("password")
    .trim()
    .notEmpty()
    .withMessage(requiredMsg("كلمة المرور"))
    .isLength({ min: 8 })
    .withMessage(minMsg("كلمة المرور", 8))
    .isLength({ max: 128 })
    .withMessage(maxMsg("كلمة المرور", 128)),
];

const loginValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage(requiredMsg("البريد الالكتروني"))
    .isEmail()
    .withMessage("صيغة البريد الالكتروني غير صحيحة")
    .normalizeEmail(),

  body("password").trim().notEmpty().withMessage(requiredMsg("كلمة المرور")),
];

const forgotPasswordValidator = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage(requiredMsg("البريد الالكتروني"))
    .isEmail()
    .withMessage("صيغة البريد الالكتروني غير صحيحة")
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body("password")
    .trim()
    .notEmpty()
    .withMessage(requiredMsg("كلمة المرور"))
    .isLength({ min: 8 })
    .withMessage(minMsg("كلمة المرور", 8))
    .isLength({ max: 128 })
    .withMessage(maxMsg("كلمة المرور", 128)),
];

const addCourseValidator = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage(requiredMsg("عنوان الكورس"))
    .isLength({ min: 8 })
    .withMessage(minMsg("عنوان الكورس", 8))
    .isLength({ max: 256 })
    .withMessage(maxMsg("عنوان الكورس", 256)),

  body("description")
    .trim()
    .notEmpty()
    .withMessage(requiredMsg("وصف الكورس"))
    .isLength({ min: 8 })
    .withMessage(minMsg("وصف الكورس", 8))
    .isLength({ max: 2400 })
    .withMessage(maxMsg("وصف الكورس", 2400)),

  body("price")
    .notEmpty()
    .withMessage(requiredMsg("السعر"))
    .isFloat({ min: 0 })
    .withMessage("السعر يجب أن يكون رقماً موجباً"),

  body("lang").trim().notEmpty().withMessage(requiredMsg("لغة الكورس")),

  body("hours")
    .notEmpty()
    .withMessage(requiredMsg("عدد الساعات"))
    .isFloat({ min: 0 })
    .withMessage("عدد الساعات يجب أن يكون رقماً موجباً"),

  body("chapterTitle").notEmpty().withMessage("يجب إضافة فصل واحد على الأقل"),
];

const addVideoValidator = [
  body("videoTitle")
    .trim()
    .notEmpty()
    .withMessage(requiredMsg("عنوان الفيديو"))
    .isLength({ max: 256 })
    .withMessage(maxMsg("عنوان الفيديو", 256)),

  body("videoId")
    .trim()
    .notEmpty()
    .withMessage("معرّف الفيديو مفقود — تأكد من اكتمال رفع الفيديو قبل الحفظ")
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage("معرّف الفيديو غير صالح"),

  body("keyHex")
    .trim()
    .notEmpty()
    .withMessage("مفتاح التشفير مفقود — تأكد من اكتمال رفع الفيديو قبل الحفظ")
    .matches(/^[0-9a-f]{32}$/i)
    .withMessage("مفتاح التشفير غير صالح"),

  body("durationSeconds")
    .notEmpty()
    .withMessage("مدة الفيديو مفقودة")
    .isFloat({ min: 0 })
    .withMessage("مدة الفيديو غير صالحة"),

  body("qualitiesJson")
    .notEmpty()
    .withMessage(
      "بيانات جودة الفيديو مفقودة — تأكد من اكتمال رفع الفيديو قبل الحفظ",
    )
    .custom((value) => {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error("بيانات جودة الفيديو غير صالحة");
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("يجب توفر جودة واحدة على الأقل للفيديو");
      }
      for (const q of parsed) {
        if (
          !q ||
          typeof q.label !== "string" ||
          typeof q.bandwidth !== "number" ||
          typeof q.playlist !== "string"
        ) {
          throw new Error("بيانات جودة الفيديو غير صالحة");
        }
      }
      return true;
    }),
];

module.exports = {
  signupValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  addCourseValidator,
  addVideoValidator,
};
