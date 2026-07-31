// Replaces a bare `next dev --turbopack -p 5173` so locale/*.json (repo
// root, outside Turbopack's now-narrowed watch root — see next.config.js)
// still hot-reloads on edit: sync once, then keep a plain fs.watch on the
// real source and re-copy into web/locale/ (which Turbopack does watch)
// whenever it changes.
"use strict";

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const { syncLocale, SOURCE_DIR } = require("./locale-sync");

syncLocale();

let pending = null;
fs.watch(SOURCE_DIR, { persistent: true }, (_event, filename) => {
  if (!filename || !filename.endsWith(".json")) return;
  clearTimeout(pending);
  pending = setTimeout(syncLocale, 50);
});

const child = spawn("next", ["dev", "--turbopack", "-p", "5173"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
