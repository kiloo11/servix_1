const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export only for production builds — dev keeps a normal Next server so
  // rewrites() below can proxy /api to the backend, matching vite.config.js's
  // old server.proxy behavior. Static export forbids rewrites/headers, so this
  // must stay conditional rather than always-on.
  ...(process.env.NEXT_OUTPUT_EXPORT ? { output: "export", trailingSlash: true, distDir: "dist" } : {}),
  images: { unoptimized: true },
  // Root one level up (repo root, not web/) — lib/i18n.js imports
  // ../../locale/*.json from outside web/, which Turbopack refuses to resolve
  // if root is scoped to web/ itself.
  turbopack: { root: path.join(__dirname, "..") },
  // Omitted entirely (not just returning []) under static export — merely
  // defining rewrites() trips Next's "not supported with output: export"
  // warning even when it returns nothing.
  ...(process.env.NEXT_OUTPUT_EXPORT
    ? {}
    : {
        async rewrites() {
          // BACKEND_PORT lets local dev point at either backend while both
          // coexist during the Node→Python migration (e.g. BACKEND_PORT=8000
          // npm run dev to test against the Python API) — defaults to the
          // Node backend's port, unchanged from before.
          const backendPort = process.env.BACKEND_PORT || 3000;
          return [{ source: "/api/:path*", destination: `http://localhost:${backendPort}/api/:path*` }];
        },
      }),
};

module.exports = nextConfig;
