const { pipeline } = require("stream");
const Course = require("../models/course.js");
const User = require("../models/user.js");
const connectDB = require("../utils/db.js");
const {
  videoObjectKey,
  getObjectBuffer,
  getObjectStream,
} = require("../utils/videoDelivery.js");

const QUALITY_LABEL_RE = /^[a-zA-Z0-9_-]+$/;
const SEGMENT_NAME_RE = /^[a-zA-Z0-9_.-]+\.ts$/;

const QUERY_TIMEOUT_MS = 8000;

const stripConditionalHeaders = (req) => {
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
};

const failStream = (res, label, error) => {
  console.error(`${label} error:`, error);
  if (res.headersSent) return res.end();
  return res.sendStatus(error && error.code === "DB_UNAVAILABLE" ? 503 : 404);
};

const loadOwnedVideo = async (req, videoId) => {
  if (!req.user) return null;

  const connect = await connectDB();
  if (!connect) {
    const dbError = new Error("Database unavailable");
    dbError.code = "DB_UNAVAILABLE";
    throw dbError;
  }

  const userDoc = await User.findOne(
    { email: req.user.data },
    "courses",
  ).maxTimeMS(QUERY_TIMEOUT_MS);
  if (!userDoc) return null;

  const course = await Course.findOne({
    "chapters.videos.videoId": videoId,
  })
    .select("+chapters.videos.keyHex")
    .maxTimeMS(QUERY_TIMEOUT_MS);
  if (!course) return null;

  const ownsThisCourse = userDoc.courses.some(
    (id) => id.toString() === course._id.toString(),
  );
  if (!ownsThisCourse) return null;

  for (const chapter of course.chapters) {
    const video = chapter.videos.find((v) => v.videoId === videoId);
    if (video) return { course, video };
  }
  return null;
};

const noStore = (res) => res.set("Cache-Control", "no-store, private");

const masterPlaylistGET = async (req, res) => {
  try {
    stripConditionalHeaders(req);
    const { videoId } = req.params;
    const owned = await loadOwnedVideo(req, videoId);
    if (!owned) return res.sendStatus(403);

    const buf = await getObjectBuffer(videoObjectKey(videoId, "master.m3u8"));

    const rewritten = buf
      .toString("utf8")
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line;
        return `/stream/${videoId}/${trimmed}`;
      })
      .join("\n");

    noStore(res).type("application/vnd.apple.mpegurl").send(rewritten);
  } catch (error) {
    return failStream(res, "masterPlaylistGET", error);
  }
};

const qualityPlaylistGET = async (req, res) => {
  try {
    stripConditionalHeaders(req);
    const { videoId, quality } = req.params;
    if (!QUALITY_LABEL_RE.test(quality)) return res.sendStatus(400);

    const owned = await loadOwnedVideo(req, videoId);
    if (!owned) return res.sendStatus(403);

    const knownQuality = owned.video.qualities.some((q) => q.label === quality);
    if (!knownQuality) return res.sendStatus(404);

    const buf = await getObjectBuffer(
      videoObjectKey(videoId, `${quality}/playlist.m3u8`),
    );

    const rewritten = buf
      .toString("utf8")
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return line;
        return `/stream/${videoId}/${quality}/${trimmed}`;
      })
      .join("\n");

    noStore(res).type("application/vnd.apple.mpegurl").send(rewritten);
  } catch (error) {
    return failStream(res, "qualityPlaylistGET", error);
  }
};

const segmentGET = async (req, res) => {
  try {
    const { videoId, quality, segment } = req.params;
    if (!QUALITY_LABEL_RE.test(quality) || !SEGMENT_NAME_RE.test(segment)) {
      return res.sendStatus(400);
    }

    const owned = await loadOwnedVideo(req, videoId);
    if (!owned) return res.sendStatus(403);

    const knownQuality = owned.video.qualities.some((q) => q.label === quality);
    if (!knownQuality) return res.sendStatus(404);

    const { stream, contentLength } = await getObjectStream(
      videoObjectKey(videoId, `${quality}/${segment}`),
    );

    noStore(res).type("video/mp2t");
    if (contentLength != null) res.set("Content-Length", String(contentLength));

    pipeline(stream, res, (err) => {
      if (err && err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
        console.error("segment stream error:", err);
      }
    });
  } catch (error) {
    return failStream(res, "segmentGET", error);
  }
};

const keyGET = async (req, res) => {
  try {
    stripConditionalHeaders(req);
    const { videoId } = req.params;
    const owned = await loadOwnedVideo(req, videoId);
    if (!owned) return res.sendStatus(403);

    noStore(res)
      .type("application/octet-stream")
      .send(Buffer.from(owned.video.keyHex, "hex"));
  } catch (error) {
    return failStream(res, "keyGET", error);
  }
};

module.exports = { masterPlaylistGET, qualityPlaylistGET, segmentGET, keyGET };