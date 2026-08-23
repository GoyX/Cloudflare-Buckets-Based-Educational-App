const {
  getUploadUrl,
  sanitizeRelativePath,
} = require("../utils/videoDelivery.js");

const MAX_FILES_PER_VIDEO = 500;

const getUploadUrlsPOST = async (req, res) => {
  try {
    const { videoId, files } = req.body;

    if (
      typeof videoId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        videoId,
      )
    ) {
      return res.status(400).json({ error: "معرّف الفيديو غير صالح" });
    }
    if (
      !Array.isArray(files) ||
      files.length === 0 ||
      files.length > MAX_FILES_PER_VIDEO
    ) {
      return res.status(400).json({ error: "قائمة الملفات غير صالحة" });
    }

    const urls = {};
    for (const relativePath of files) {
      const clean = sanitizeRelativePath(relativePath);
      if (!clean) {
        return res
          .status(400)
          .json({ error: `مسار ملف غير مسموح به: ${relativePath}` });
      }
      urls[relativePath] = await getUploadUrl(videoId, clean);
    }

    return res.json({ videoId, urls });
  } catch (error) {
    console.error("getUploadUrlsPOST error:", error);
    return res.status(500).json({ error: "فشل توليد روابط الرفع" });
  }
};

module.exports = { getUploadUrlsPOST };
