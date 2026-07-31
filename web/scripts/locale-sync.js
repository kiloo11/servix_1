// Mirrors the repo-root locale/*.json files (the real source of truth,
// shared with the backend — see CLAUDE.md) into web/locale/, purely so
// web/lib/i18n.js can import them from *inside* web/. This exists only to
// let next.config.js's turbopack.root stay scoped to web/ itself instead of
// the whole repo — see the comment there for why that scope matters (it's a
// real CPU problem, not tidiness).
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_DIR = path.join(__dirname, "..", "..", "locale");
const DEST_DIR = path.join(__dirname, "..", "locale");
const FILES = ["ru.json", "en.json"];

function syncLocale() {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  for (const file of FILES) {
    fs.copyFileSync(path.join(SOURCE_DIR, file), path.join(DEST_DIR, file));
  }
}

module.exports = { syncLocale, SOURCE_DIR, DEST_DIR, FILES };
