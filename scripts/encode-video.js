#!/usr/bin/env node
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const path = require("path");
const {
  encodeOneVideo,
  formatDuration,
  checkTool,
  EncodeError,
} = require("./lib/encodeOne.js");

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function main() {
  const [, , inputArg, outputDirArg] = process.argv;
  if (!inputArg) {
    fail("Usage: node scripts/encode-video.js <input.mp4> [outputDir]");
  }

  const inputPath = path.resolve(inputArg);
  const outputRoot = path.resolve(outputDirArg || "./encoded-output");
  const baseUrl = process.env.BASE_URL;

  try {
    checkTool("ffmpeg");
    checkTool("ffprobe");

    const startedAt = Date.now();
    const result = encodeOneVideo({ inputPath, outputRoot, baseUrl });
    const totalElapsed = Date.now() - startedAt;

    console.log(`Total time: ${formatDuration(totalElapsed)}`);
  } catch (err) {
    if (err instanceof EncodeError) {
      fail(err.message);
    }
    throw err;
  }
}

main();
