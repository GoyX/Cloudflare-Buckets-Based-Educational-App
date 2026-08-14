#!/usr/bin/env node
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});

const fs = require("fs");
const path = require("path");
const {
  encodeOneVideo,
  formatDuration,
  checkTool,
  EncodeError,
} = require("./lib/encodeOne.js");

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".m4v",
  ".avi",
  ".webm",
]);
const naturalSort = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
}).compare;

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function sanitizeFolderName(name) {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "untitled";
}

function listChapterDirs(courseDir) {
  return fs
    .readdirSync(courseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(naturalSort);
}

function listVideoFiles(chapterDir) {
  return fs
    .readdirSync(chapterDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isFile() && VIDEO_EXTENSIONS.has(path.extname(d.name).toLowerCase()),
    )
    .map((d) => d.name)
    .sort(naturalSort);
}

function main() {
  const [, , courseArg, outputDirArg] = process.argv;
  if (!courseArg) {
    fail('Usage: node scripts/encode-course.js "<courseDir>" [outputDir]');
  }

  const courseDir = path.resolve(courseArg);
  if (!fs.existsSync(courseDir) || !fs.statSync(courseDir).isDirectory()) {
    fail(`Course folder not found: ${courseDir}`);
  }

  const baseUrl = process.env.BASE_URL;
  const outputRoot = path.resolve(outputDirArg || "./encoded-output");

  checkTool("ffmpeg");
  checkTool("ffprobe");

  const chapterNames = listChapterDirs(courseDir);
  if (chapterNames.length === 0) {
    fail(`No chapter subfolders found inside ${courseDir}`);
  }

  const jobs = [];
  for (const chapterName of chapterNames) {
    const chapterDir = path.join(courseDir, chapterName);
    const videoFiles = listVideoFiles(chapterDir);
    for (const fileName of videoFiles) {
      jobs.push({
        chapterName,
        fileName,
        inputPath: path.join(chapterDir, fileName),
        title: path.basename(fileName, path.extname(fileName)),
      });
    }
  }

  if (jobs.length === 0) {
    fail(
      `No video files (${[...VIDEO_EXTENSIONS].join(", ")}) found in any chapter folder under ${courseDir}`,
    );
  }

  console.log(
    `\nFound ${jobs.length} video(s) across ${chapterNames.length} chapter(s).\n`,
  );

  const results = [];
  const batchStartedAt = Date.now();

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const heading = `[${i + 1}/${jobs.length}] ${job.chapterName} / ${job.fileName}`;
    console.log(
      `\n${"=".repeat(heading.length)}\n${heading}\n${"=".repeat(heading.length)}`,
    );

    const chapterOutputDir = path.join(
      outputRoot,
      sanitizeFolderName(job.chapterName),
    );
    const folderName = sanitizeFolderName(job.title);

    try {
      const result = encodeOneVideo({
        inputPath: job.inputPath,
        outputRoot: chapterOutputDir,
        baseUrl,
        title: job.title,
        folderName,
      });
      results.push({
        chapter: job.chapterName,
        file: job.fileName,
        title: job.title,
        status: "ok",
        videoId: result.videoId,
        outputDir: result.videoDir,
        durationSeconds: result.durationSeconds,
        elapsedMs: result.elapsedMs,
      });
      console.log(
        `  ✓ [${i + 1}/${jobs.length}] finished in ${formatDuration(result.elapsedMs)}`,
      );
    } catch (err) {
      const message =
        err instanceof EncodeError ? err.message : err.message || String(err);
      console.error(
        `\n  ✗ [${i + 1}/${jobs.length}] FAILED: ${message}\n  Continuing with the next video...\n`,
      );
      results.push({
        chapter: job.chapterName,
        file: job.fileName,
        title: job.title,
        status: "failed",
        error: message,
      });
    }

    const elapsedSoFar = Date.now() - batchStartedAt;
    const avgPerDone = elapsedSoFar / (i + 1);
    const remaining = jobs.length - (i + 1);
    if (remaining > 0) {
      console.log(
        `  Elapsed so far: ${formatDuration(elapsedSoFar)} — rough estimate for remaining ${remaining}: ${formatDuration(avgPerDone * remaining)}`,
      );
    }
  }

  const totalElapsed = Date.now() - batchStartedAt;
  const succeeded = results.filter((r) => r.status === "ok");
  const failed = results.filter((r) => r.status === "failed");

  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(
    path.join(outputRoot, "_course-summary.json"),
    JSON.stringify(
      {
        courseDir,
        generatedAt: new Date().toISOString(),
        totalElapsedMs: totalElapsed,
        results,
      },
      null,
      2,
    ),
  );

  console.log(`\n${"=".repeat(40)}`);
  console.log(
    `Done: ${succeeded.length}/${jobs.length} succeeded in ${formatDuration(totalElapsed)}`,
  );
  if (failed.length > 0) {
    console.log(
      `\n${failed.length} video(s) FAILED — re-run scripts/encode-video.js on these individually:`,
    );
    for (const f of failed) {
      console.log(`  - ${f.chapter} / ${f.file}: ${f.error}`);
    }
  }
  console.log(
    `\nSummary written to: ${path.join(outputRoot, "_course-summary.json")}`,
  );
  console.log(
    `Upload each succeeded video's folder through the admin panel (courseManage / addCourse).\n`,
  );
}

main();
