const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

for (const key of [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
]) {
  if (!process.env[key]) {
    console.warn(
      `[videoDelivery] Missing env var ${key} — video upload/playback will fail until it's set in .env`,
    );
  }
}

const r2 = new S3Client({
  region: "auto",
  endpoint:
    process.env.R2_ENDPOINT ||
    `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET;

const videoObjectKey = (videoId, relativePath) =>
  `hls/${videoId}/${relativePath}`;

const sanitizeRelativePath = (relativePath) => {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.length > 300
  ) {
    return null;
  }
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.includes("..")) return null;
  if (!/^[a-zA-Z0-9_\-./]+$/.test(normalized)) return null;
  if (!/\.(m3u8|ts|jpg|jpeg|png)$/i.test(normalized)) return null;
  return normalized;
};

const getUploadUrl = async (videoId, relativePath, expiresIn = 900) => {
  const key = videoObjectKey(videoId, relativePath);
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn });
};

const getObjectBuffer = async (key) => {
  const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of obj.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const getObjectStream = async (key) => {
  const obj = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return { stream: obj.Body, contentLength: obj.ContentLength };
};

const objectExists = async (key) => {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  videoObjectKey,
  sanitizeRelativePath,
  getUploadUrl,
  getObjectBuffer,
  getObjectStream,
  objectExists,
};
