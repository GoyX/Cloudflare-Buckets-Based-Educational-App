const Course = require("../models/course.js");
const User = require("../models/user.js");
const {
  videoObjectKey,
  getObjectBuffer,
  getObjectStream,
} = require("../utils/videoDelivery.js");

const QUALITY_LABEL_RE = /^[a-zA-Z0-9_-]+$/;
const SEGMENT_NAME_RE = /^[a-zA-Z0-9_.-]+\.ts$/;

const loadOwnedVideo = async (req, videoId) => {
  if (!req.user) return null;

  const userDoc = await User.findOne({ email: req.user.data }, "courses");
  if (!userDoc) return null;

  const course = await Course.findOne({
    "chapters.videos.videoId": videoId,
  }).select("+chapters.videos.keyHex");
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
    console.error("masterPlaylistGET error:", error);
    return res.sendStatus(404);
  }
};

const qualityPlaylistGET = async (req, res) => {
  try {
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
    console.error("qualityPlaylistGET error:", error);
    return res.sendStatus(404);
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

    stream.on("error", (err) => {
      console.error("segment stream error:", err);
      if (!res.headersSent) res.sendStatus(500);
      else res.end();
    });
    stream.pipe(res);
  } catch (error) {
    console.error("segmentGET error:", error);
    return res.sendStatus(404);
  }
};

const keyGET = async (req, res) => {
  try {
    const { videoId } = req.params;
    const owned = await loadOwnedVideo(req, videoId);
    if (!owned) return res.sendStatus(403);

    noStore(res)
      .type("application/octet-stream")
      .send(Buffer.from(owned.video.keyHex, "hex"));
  } catch (error) {
    console.error("keyGET error:", error);
    return res.sendStatus(404);
  }
};

module.exports = { masterPlaylistGET, qualityPlaylistGET, segmentGET, keyGET };
