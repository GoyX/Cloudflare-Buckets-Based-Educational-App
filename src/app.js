require("dotenv").config();

const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const connectDB = require("./utils/db.js");
const counter = require("./utils/viewsCounter.js");
const routes = require("./routes/routes.js");
const path = require("path");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/public/views"));

if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "2mb" }));

app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));

app.use(require("./routes/smtp-test.route.js"));
app.get("/healthz", (req, res) => {
  res.status(200).json({ success: "true" });
});

app.use(counter.count);

app.use(routes);

app.use((req, res) => {
  res.status(404);
  const renderData = {
    css: "error.css",
    error: "الصفحة غير موجودة (404)",
    back: "/",
    user: null,
  };

  res.render("error", renderData, (err, html) => {
    if (err) {
      return res.send(
        `<html><head><meta charset="utf-8"><title>Not Found</title></head><body><h1>الصفحة غير موجودة (404)</h1><a href="/">العودة</a></body></html>`,
      );
    }
    res.send(html);
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  const message =
    err.code === "LIMIT_FILE_SIZE"
      ? "حجم الملف يتجاوز الحد المسموح به (5 MB)"
      : err.message || "حدث خطأ داخلي";

  res.status(err.status || 500);
  const renderData = {
    css: "error.css",
    error: message,
    back: req.headers.referer || "/",
    user: req.user || null,
  };

  res.render("error", renderData, (renderErr, html) => {
    if (renderErr) {
      return res.send(
        `<html><head><meta charset="utf-8"><title>Error</title></head><body><h1>${message}</h1><a href="${renderData.back}">العودة</a></body></html>`,
      );
    }
    res.send(html);
  });
});

const PORT = process.env.PORT || 3000;

connectDB()
  .then((conn) => {
    if (!conn) {
      console.error("Could not connect to MongoDB. Exiting.");
      process.exit(1);
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`,
      );
    });
  })
  .catch((err) => {
    console.error("Startup error:", err);
    process.exit(1);
  });
