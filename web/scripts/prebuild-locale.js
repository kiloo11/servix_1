// npm's automatic "prebuild" hook — runs before `npm run build` (see
// package.json). One-shot sync, no watching needed for a single build.
"use strict";

const { syncLocale } = require("./locale-sync");

syncLocale();
