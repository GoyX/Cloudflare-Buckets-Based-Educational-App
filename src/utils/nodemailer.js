const nodemailer = require("nodemailer");

const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

/**
 * @param {string} to
 * @param {string} otp
 * @param {string} userId
 */
const sendMail = async (to, otp, userId) => {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const verifyLink = `${baseUrl}/verify/${userId}/${otp}`;

  const transporter = createTransporter();

  const mailOptions = {
    from: `"OHS Academy" <${process.env.MAIL_USER}>`,
    to,
    subject: "توثيق البريد الالكتروني - Operative High Class",
    text: `مرحباً،\n\nاضغط على الرابط التالي لتوثيق حسابك (صالح لمدة 10 دقائق):\n${verifyLink}\n\nإذا لم تطلب هذا، تجاهل الرسالة.`,
    html: `
               <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 540px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #1d4ed8; margin-bottom: 16px;">توثيق البريد الالكتروني</h2>
                    <p style="color: #374151; line-height: 1.7;">مرحباً،</p>
                    <p style="color: #374151; line-height: 1.7;">اضغط على الزر أدناه لتوثيق حسابك في <strong>OHS Academy</strong>. الرابط صالح لمدة <strong>10 دقائق</strong>.</p>
                    <a href="${verifyLink}"
                       style="display: inline-block; margin: 24px 0; padding: 12px 28px; background-color: #1d4ed8; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">
                         توثيق الحساب
                    </a>
                    <p style="color: #6b7280; font-size: 13px;">إذا لم تطلب إنشاء حساب، تجاهل هذه الرسالة.</p>
               </div>
          `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("sendMail error:", err);
    throw err;
  }
};

/**
 *
 * @param {string} to
 * @param {string} otp
 */
const sendResetMail = async (to, otp) => {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password/${to}/${otp}`;

  const transporter = createTransporter();

  const mailOptions = {
    from: `"OHS Academy" <${process.env.MAIL_USER}>`,
    to,
    subject: "إعادة تعيين كلمة المرور - Operative High Class",
    text: `مرحباً،\n\nاضغط على الرابط التالي لإعادة تعيين كلمة المرور (صالح لمدة 10 دقائق):\n${resetLink}\n\nإذا لم تطلب هذا، تجاهل الرسالة.`,
    html: `
               <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 540px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <h2 style="color: #1d4ed8; margin-bottom: 16px;">إعادة تعيين كلمة المرور</h2>
                    <p style="color: #374151; line-height: 1.7;">مرحباً،</p>
                    <p style="color: #374151; line-height: 1.7;">اضغط على الزر أدناه لإعادة تعيين كلمة مرورك في <strong>OHS Academy</strong>. الرابط صالح لمدة <strong>10 دقائق</strong>.</p>
                    <a href="${resetLink}"
                       style="display: inline-block; margin: 24px 0; padding: 12px 28px; background-color: #1d4ed8; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">
                         إعادة تعيين كلمة المرور
                    </a>
                    <p style="color: #6b7280; font-size: 13px;">إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة وكلمة مرورك ستبقى كما هي.</p>
               </div>
          `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("sendResetMail error:", err);
    throw err;
  }
};

module.exports = { sendMail, sendResetMail };
