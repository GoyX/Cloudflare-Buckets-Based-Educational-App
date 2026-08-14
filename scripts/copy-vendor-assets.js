#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(
  __dirname,
  "..",
  "node_modules",
  "@videojs",
  "html",
  "cdn",
);
const DEST_DIR = path.join(
  __dirname,
  "..",
  "src",
  "public",
  "js",
  "vendor",
  "videojs-html",
);

function shouldSkip(fileName) {
  return (
    fileName.endsWith(".map") ||
    fileName.endsWith(".dev.js") ||
    fileName.endsWith(".dev.d.ts")
  );
}

function copyRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  let copied = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copied += copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      copied++;
    }
  }
  return copied;
}

if (!fs.existsSync(SRC_DIR)) {
  console.warn(`[copy-vendor-assets] Skipping — not found: ${SRC_DIR}`);
  process.exit(0);
}

const count = copyRecursive(SRC_DIR, DEST_DIR);
console.log(
  `[copy-vendor-assets] Copied ${count} files from @videojs/html/cdn -> src/public/js/vendor/videojs-html/`,
);
