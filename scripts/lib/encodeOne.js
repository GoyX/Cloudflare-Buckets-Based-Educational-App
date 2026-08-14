const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync, spawnSync } = require("child_process");

const VIDEO_BITRATE_480P = 1_200_000;
const AUDIO_BITRATE = 96_000;
const SEGMENT_SECONDS = 6;

class EncodeError extends Error {}

function checkTool(name) {
  const result = spawnSync(name, ["-version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new EncodeError(
      `"${name}" not found on PATH. Install FFmpeg (with NVENC support for the GPU pass) first.`,
    );
  }
}

function probe(inputPath) {
  const raw = execFileSync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "format=duration,bit_rate:stream=width,height,codec_name",
    "-of",
    "json",
    inputPath,
  ]).toString();
  const data = JSON.parse(raw);
  const stream = (data.streams && data.streams[0]) || {};
  return {
    durationSeconds: Math.round(parseFloat(data.format?.duration || "0")),
    bitRate: parseInt(data.format?.bit_rate || "0", 10),
    width: stream.width || null,
    height: stream.height || null,
    codecName: stream.codec_name || null,
  };
}

function hasNvenc() {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], {
    encoding: "utf8",
  });
  return /h264_nvenc/.test(result.stdout || "");
}

function runFfmpeg(args, label) {
  console.log(`\n  → ${label}`);
  console.log(`    ffmpeg ${args.join(" ")}\n`);
  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  return result.status === 0;
}

function formatDuration(ms) {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 *
 *
 *
 * @param {object} opts
 * @param {string} opts.inputPath
 * @param {string} opts.outputRoot
 * @param {string} opts.baseUrl
 * @param {string} [opts.title]
 *
 * @param {string} [opts.folderName]
 *
 *
 *
 * @returns {{ videoId: string, videoDir: string, durationSeconds: number, elapsedMs: number }}
 * @throws {EncodeError}
 */
function encodeOneVideo({ inputPath, outputRoot, baseUrl, title, folderName }) {
  const startedAt = Date.now();

  if (!fs.existsSync(inputPath)) {
    throw new EncodeError(`Input file not found: ${inputPath}`);
  }
  if (!baseUrl) {
    throw new EncodeError(
      "BASE_URL is not set — the AES key URI baked into every HLS playlist needs it.",
    );
  }

  const resolvedTitle =
    title || path.basename(inputPath, path.extname(inputPath));

  const videoId = crypto.randomUUID();
  const videoDir = path.join(outputRoot, folderName || videoId);
  const dir480 = path.join(videoDir, "480p");
  const dirOriginal = path.join(videoDir, "original");
  fs.mkdirSync(dir480, { recursive: true });
  fs.mkdirSync(dirOriginal, { recursive: true });

  console.log(`  Video ID: ${videoId}`);
  console.log(`  Output:   ${videoDir}`);

  const info = probe(inputPath);
  if (!info.durationSeconds) {
    throw new EncodeError(
      "Could not read duration from input file — is it a valid video?",
    );
  }
  console.log(
    `  Source:   ${info.width}x${info.height}, ${info.codecName}, ${info.durationSeconds}s, ~${Math.round(info.bitRate / 1000)} kbps`,
  );

  if (info.codecName && info.codecName !== "h264") {
    console.warn(
      `\n  ⚠ Source codec is "${info.codecName}", not h264 — the "original quality" pass uses -c copy ` +
        `(no re-encode), which assumes H.264/AAC for broad HLS compatibility.\n`,
    );
  }

  const keyBytes = crypto.randomBytes(16);
  const keyHex = keyBytes.toString("hex");
  const keyPath = path.join(videoDir, "enc.key");
  const keyInfoPath = path.join(videoDir, "keyinfo.txt");
  fs.writeFileSync(keyPath, keyBytes);
  fs.writeFileSync(
    keyInfoPath,
    `${baseUrl.replace(/\/$/, "")}/stream/${videoId}/key\n${keyPath}\n`,
  );

  const originalOk = runFfmpeg(
    [
      "-y",
      "-i",
      inputPath,
      "-c",
      "copy",
      "-hls_time",
      String(SEGMENT_SECONDS),
      "-hls_playlist_type",
      "vod",
      "-hls_key_info_file",
      keyInfoPath,
      "-hls_segment_filename",
      path.join(dirOriginal, "seg_%03d.ts"),
      path.join(dirOriginal, "playlist.m3u8"),
    ],
    "Pass 1/2 — original quality (remux + encrypt, no re-encode)",
  );
  if (!originalOk)
    throw new EncodeError(
      "Original-quality pass failed — see ffmpeg output above.",
    );

  const build480Args = (useNvenc) => [
    "-y",
    ...(useNvenc ? ["-hwaccel", "cuda"] : []),
    "-i",
    inputPath,
    "-vf",
    "scale=-2:480",
    "-c:v",
    useNvenc ? "h264_nvenc" : "libx264",
    ...(useNvenc ? ["-preset", "p5"] : ["-preset", "fast"]),
    "-b:v",
    String(VIDEO_BITRATE_480P),
    "-maxrate",
    String(Math.round(VIDEO_BITRATE_480P * 1.25)),
    "-bufsize",
    String(VIDEO_BITRATE_480P * 2),
    "-c:a",
    "aac",
    "-b:a",
    String(AUDIO_BITRATE),
    "-hls_time",
    String(SEGMENT_SECONDS),
    "-hls_playlist_type",
    "vod",
    "-hls_key_info_file",
    keyInfoPath,
    "-hls_segment_filename",
    path.join(dir480, "seg_%03d.ts"),
    path.join(dir480, "playlist.m3u8"),
  ];

  let q480Ok = false;
  if (hasNvenc()) {
    console.log("\n  (ffmpeg has NVENC support — attempting GPU encode)");
    q480Ok = runFfmpeg(build480Args(true), "Pass 2/2 — 480p (NVENC re-encode)");
    if (!q480Ok) {
      console.warn(
        "\n  ⚠ NVENC attempt failed (no usable GPU/driver right now, most likely) — retrying on CPU with libx264.\n",
      );
    }
  } else {
    console.log(
      "\n  (this ffmpeg build has no NVENC support — using CPU libx264)",
    );
  }
  if (!q480Ok) {
    q480Ok = runFfmpeg(
      build480Args(false),
      "Pass 2/2 — 480p (libx264 CPU re-encode)",
    );
  }
  if (!q480Ok)
    throw new EncodeError(
      "480p pass failed on both NVENC and libx264 — see ffmpeg output above.",
    );

  const originalBandwidth = info.bitRate || VIDEO_BITRATE_480P * 4;
  const masterLines = [
    "#EXTM3U",
    `#EXT-X-STREAM-INF:BANDWIDTH=${VIDEO_BITRATE_480P + AUDIO_BITRATE},RESOLUTION=854x480`,
    "480p/playlist.m3u8",
    `#EXT-X-STREAM-INF:BANDWIDTH=${originalBandwidth}${info.width ? `,RESOLUTION=${info.width}x${info.height}` : ""}`,
    "original/playlist.m3u8",
    "",
  ];
  fs.writeFileSync(path.join(videoDir, "master.m3u8"), masterLines.join("\n"));

  const manifest = {
    videoId,
    title: resolvedTitle,
    durationSeconds: info.durationSeconds,
    keyHex,
    qualities: [
      {
        label: "480p",
        bandwidth: VIDEO_BITRATE_480P + AUDIO_BITRATE,
        playlist: "480p/playlist.m3u8",
        resolution: "854x480",
      },
      {
        label: "original",
        bandwidth: originalBandwidth,
        playlist: "original/playlist.m3u8",
        resolution: info.width ? `${info.width}x${info.height}` : undefined,
      },
    ],
  };
  fs.writeFileSync(
    path.join(videoDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `\n  ✓ Done in ${formatDuration(elapsedMs)}. Upload this folder:\n    ${videoDir}\n`,
  );

  return {
    videoId,
    videoDir,
    durationSeconds: info.durationSeconds,
    elapsedMs,
  };
}

module.exports = { encodeOneVideo, formatDuration, checkTool, EncodeError };
