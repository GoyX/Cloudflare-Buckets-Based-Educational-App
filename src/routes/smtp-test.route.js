// TEMPORARY DIAGNOSTIC ROUTE — delete this file and its require() line
// in app.js once you're done testing.
//
// Usage:
//   1. Save this as src/routes/smtp-test.route.js
//   2. In app.js, add near your other route mounts:
//        app.use(require("./routes/smtp-test.route.js"));
//   3. Deploy.
//   4. Visit https://<your-app>.onrender.com/smtp-test in the browser.
//   5. Read the JSON result.
//   6. Remove the require() line from app.js and delete this file.

const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

async function testPort(port, secure) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port,
    secure,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });

  const start = Date.now();
  try {
    await transporter.verify();
    return { port, secure, ok: true, ms: Date.now() - start };
  } catch (err) {
    return {
      port,
      secure,
      ok: false,
      ms: Date.now() - start,
      code: err.code || null,
      message: err.message || String(err),
    };
  }
}

router.get("/smtp-test", async (req, res) => {
  const results = {
    mailUserSet: !!process.env.MAIL_USER,
    mailPassSet: !!process.env.MAIL_PASS,
    port465: await testPort(465, true),
    port587: await testPort(587, false),
  };

  res.json(results);
});

module.exports = router;
