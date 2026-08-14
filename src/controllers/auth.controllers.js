const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const mailer = require("../utils/nodemailer.js");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

const connectDB = require("../utils/db.js");
const User = require("../models/user.js");
const Otp = require("../models/otp.js");

const generateOtp = () => Math.floor(100000 + Math.random() * 900000);

const renderSignup = (res, req, overrides = {}) =>
  res.render("signup", {
    css: "signup.css",
    errors: null,
    error: null,
    note: null,
    user: req.user,
    ...overrides,
  });

const renderLogin = (res, req, overrides = {}) =>
  res.render("login", {
    css: "login.css",
    errors: null,
    error: null,
    note: null,
    user: req.user,
    ...overrides,
  });

const renderVerify = (res, req, overrides = {}) =>
  res.render("verify", {
    css: "verify.css",
    errors: null,
    error: null,
    note: null,
    newCode: false,
    user: req.user,
    ...overrides,
  });

const renderForgot = (res, req, overrides = {}) =>
  res.render("forgot-password", {
    css: "forgotPassword.css",
    errors: null,
    error: null,
    note: null,
    user: req.user,
    ...overrides,
  });

const renderReset = (res, req, overrides = {}) =>
  res.render("resetPassword", {
    css: "resetPassword.css",
    errors: null,
    error: null,
    note: null,
    user: req.user,
    email: req.params.email,
    otp: req.params.otp,
    ...overrides,
  });

const signupGET = (req, res) => renderSignup(res, req);
const loginGET = (req, res) => renderLogin(res, req);

const signupPOST = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return renderSignup(res, req, { errors: errors.array() });
  }

  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/signup",
        user: req.user,
      });
    }

    const { userName, email, password } = req.body;

    const oldUser = await User.findOne({ email });
    if (oldUser) {
      return renderSignup(res, req, { error: "البريد الالكتروني مسجل بالفعل" });
    }

    const SALT_ROUNDS = 12;
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = new User({
      userName,
      email,
      password: hashedPassword,
      userId: Math.floor(100000 + Math.random() * 900000),
    });

    const saveUser = await newUser.save();

    const otp = generateOtp();
    const otpHashed = await bcrypt.hash(otp.toString(), SALT_ROUNDS);
    const newOtp = new Otp({ otp: otpHashed, otpUser: saveUser._id });
    await newOtp.save();

    const otpForLink = otpHashed.replace(/\//g, "slash");

    mailer.sendMail(email, otpForLink, saveUser._id).catch((mailErr) => {
      console.error("sendMail (background) error:", mailErr);
    });

    return renderSignup(res, req, {
      note: "تم تسجيل الحساب، تحقق من بريدك الالكتروني للتوثيق (صالح 10 دقائق)",
    });
  } catch (error) {
    console.error("signupPOST error:", error);
    if (error.code === 11000) {
      return renderSignup(res, req, { error: "حدث خطأ، أعد المحاولة" });
    }
    return renderSignup(res, req, {
      error: "فشل التسجيل، أعد المحاولة في وقت لاحق",
    });
  }
};

const verify = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/signup",
        user: req.user,
      });
    }

    const { id } = req.params;
    let { otp } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return renderVerify(res, req, {
        error: "فشل التوثيق: المستخدم غير موجود",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return renderVerify(res, req, {
        error: "فشل التوثيق: المستخدم غير موجود",
      });
    }
    if (user.verified) {
      return renderVerify(res, req, {
        error: "الحساب موثق بالفعل! سجل الدخول",
      });
    }

    const checkOtp = await Otp.findOne({ otpUser: user._id });
    if (!checkOtp) {
      return renderVerify(res, req, {
        error: "فشل التوثيق: انتهت صلاحية الرمز",
        newCode: user._id,
      });
    }

    otp = otp.replace(/slash/g, "/");
    const isValid = checkOtp.otp === otp;
    if (!isValid) {
      return renderVerify(res, req, {
        error: "فشل التوثيق: الرمز غير صالح",
        newCode: user._id,
      });
    }

    await User.findByIdAndUpdate(user._id, { verified: true });
    await Otp.findOneAndDelete({ _id: checkOtp._id });

    return renderVerify(res, req, {
      note: "تم توثيق الحساب بنجاح! يمكنك تسجيل الدخول الآن",
    });
  } catch (error) {
    console.error("verify error:", error);
    return renderVerify(res, req, {
      error: "فشل التوثيق، حاول مرة أخرى في وقت لاحق",
    });
  }
};

const newVerify = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/signup",
        user: req.user,
      });
    }

    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return renderVerify(res, req, { error: "المستخدم غير موجود" });
    }

    const checkUser = await User.findById(id);
    if (!checkUser) {
      return renderVerify(res, req, {
        error: "فشل إرسال بريد التوثيق: المستخدم غير موجود",
      });
    }
    if (checkUser.verified) {
      return renderVerify(res, req, {
        error: "الحساب موثق بالفعل! سجل الدخول",
      });
    }

    await Otp.findOneAndDelete({ otpUser: checkUser._id });

    const SALT_ROUNDS = 12;
    const otp = generateOtp();
    const otpHashed = await bcrypt.hash(otp.toString(), SALT_ROUNDS);
    const newOtp = new Otp({ otp: otpHashed, otpUser: checkUser._id });
    await newOtp.save();

    const otpForLink = otpHashed.replace(/\//g, "slash");
    await mailer.sendMail(checkUser.email, otpForLink, checkUser._id);

    return renderVerify(res, req, {
      note: "تم إرسال بريد توثيق جديد، تحقق من بريدك الإلكتروني",
    });
  } catch (error) {
    console.error("newVerify error:", error);
    return renderVerify(res, req, {
      error: "فشل إرسال بريد التوثيق، حاول مرة أخرى في وقت لاحق",
    });
  }
};

const loginPOST = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return renderLogin(res, req, { errors: errors.array() });
  }

  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/login",
        user: req.user,
      });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return renderLogin(res, req, {
        error: "البريد الالكتروني أو كلمة المرور خاطئة",
      });
    }
    if (!user.verified) {
      return renderLogin(res, req, {
        error: "يجب تأكيد البريد الالكتروني أولاً، تحقق من بريدك الالكتروني",
      });
    }

    const checkPassword = await bcrypt.compare(password, user.password);
    if (!checkPassword) {
      return renderLogin(res, req, {
        error: "البريد الالكتروني أو كلمة المرور خاطئة",
      });
    }

    const token = jwt.sign(
      { data: user.email, admin: user.admin },
      process.env.PRIVATE_KEY,
      { expiresIn: "7d" },
    );

    res.cookie("toJtkn", token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    });

    return res.redirect("/");
  } catch (error) {
    console.error("loginPOST error:", error);
    return renderLogin(res, req, {
      error: "فشلت عملية تسجيل الدخول، حاول مرة أخرى في وقت لاحق",
    });
  }
};

const forgotPasswordGET = (req, res) => renderForgot(res, req);

const forgotPasswordPOST = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return renderForgot(res, req, { errors: errors.array() });
  }

  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/login",
        user: req.user,
      });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.verified) {
      return renderForgot(res, req, {
        note: "إذا كان البريد مسجلاً وموثقاً، ستصلك رسالة لإعادة التعيين",
      });
    }

    await Otp.findOneAndDelete({ otpUser: user._id });

    const SALT_ROUNDS = 12;
    const otp = generateOtp();
    const otpHashed = await bcrypt.hash(otp.toString(), SALT_ROUNDS);
    const otpForLink = otpHashed.replace(/\//g, "slash");

    const newOtp = new Otp({ otp: otpHashed, otpUser: user._id });
    await newOtp.save();

    mailer.sendResetMail(user.email, otpForLink).catch((mailErr) => {
      console.error("sendResetMail (background) error:", mailErr);
    });

    return renderForgot(res, req, {
      note: "إذا كان البريد مسجلاً وموثقاً، ستصلك رسالة لإعادة التعيين",
    });
  } catch (error) {
    console.error("forgotPasswordPOST error:", error);
    return renderForgot(res, req, {
      error: "فشل إرسال بريد إعادة التعيين، حاول مرة أخرى في وقت لاحق",
    });
  }
};

const resetPasswordGET = async (req, res) => {
  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/login",
        user: req.user,
      });
    }

    const { email, otp } = req.params;
    const decodedOtp = otp.replace(/slash/g, "/");

    const findUser = await User.findOne({ email });
    if (!findUser) {
      return renderReset(res, req, {
        error: "الجلسة غير صالحة، أعد الإرسال مرة أخرى",
      });
    }

    const findOtp = await Otp.findOne({ otpUser: findUser._id });
    if (!findOtp) {
      return renderReset(res, req, {
        error: "انتهت صلاحية الجلسة، أعد طلب إعادة التعيين",
      });
    }

    if (findOtp.otp !== decodedOtp) {
      return renderReset(res, req, {
        error: "الجلسة غير صالحة، أعد الإرسال مرة أخرى",
      });
    }

    return renderReset(res, req);
  } catch (error) {
    console.error("resetPasswordGET error:", error);
    return renderReset(res, req, {
      error: "الجلسة غير صالحة، أعد الإرسال مرة أخرى",
    });
  }
};

const resetPasswordPOST = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return renderReset(res, req, { errors: errors.array() });
  }

  try {
    const connect = await connectDB();
    if (!connect) {
      return res.render("error", {
        css: "error.css",
        error: "فشل الاتصال بالخدمة",
        back: "/login",
        user: req.user,
      });
    }

    const { email } = req.params;
    const { password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return renderReset(res, req, {
        error: "الجلسة غير صالحة، أعد الإرسال مرة أخرى",
      });
    }

    const otpCheck = await Otp.findOne({ otpUser: user._id });
    if (!otpCheck) {
      return renderReset(res, req, {
        error: "انتهت صلاحية الجلسة، أعد طلب إعادة التعيين",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const updatePassword = await User.findOneAndUpdate(
      { email: user.email },
      { $set: { password: hashedPassword } },
    );

    if (!updatePassword) {
      return renderReset(res, req, {
        error: "فشل إعادة التعيين، جرب مرة أخرى في وقت لاحق",
      });
    }

    await Otp.findOneAndDelete({ otpUser: user._id });

    return renderReset(res, req, {
      note: "تم إعادة تعيين كلمة المرور، سجل دخولك الآن",
    });
  } catch (error) {
    console.error("resetPasswordPOST error:", error);
    return renderReset(res, req, {
      error: "فشل إعادة التعيين، جرب مرة أخرى في وقت لاحق",
    });
  }
};

const logout = (req, res) => {
  res.clearCookie("toJtkn");
  return res.redirect("/login");
};

module.exports = {
  signupGET,
  loginGET,
  loginPOST,
  signupPOST,
  verify,
  newVerify,
  forgotPasswordGET,
  forgotPasswordPOST,
  resetPasswordGET,
  resetPasswordPOST,
  logout,
};
