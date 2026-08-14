const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_THUMBNAIL_SIZE_BYTES = 5 * 1024 * 1024;

const imageFileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `نوع الملف غير مدعوم. الأنواع المسموح بها: JPEG, PNG, WebP, GIF`,
      ),
      false,
    );
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "..", "public", "uploads"));
  },
  filename: function (req, file, cb) {
    const extMap = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
    };
    const ext = extMap[file.mimetype] || ".jpg";
    const safeName = crypto.randomBytes(16).toString("hex") + ext;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: MAX_THUMBNAIL_SIZE_BYTES },
});

module.exports = { upload };
