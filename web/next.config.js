/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export only for production builds — dev keeps a normal Next server so
  // rewrites() below can proxy /api to the backend. Static export forbids
  // rewrites/headers, so this must stay conditional rather than always-on.
  ...(process.env.NEXT_OUTPUT_EXPORT ? { output: "export", trailingSlash: true, distDir: "dist" } : {}),
  images: { unoptimized: true },
  // No turbopack.root override — deliberately left at the default (web/
  // itself). It used to be pointed one level up at the repo root so
  // lib/i18n.js could import ../../locale/*.json directly, but that made
  // Turbopack's dev-server file watcher span the entire repo — including
  // api/.venv (~13k files) and .git — which measured at 600-700% sustained
  // CPU at idle. scripts/dev.js and scripts/prebuild-locale.js instead sync
  // locale/*.json into web/locale/ (inside root) before Next starts, and
  // lib/i18n.js imports from there; see scripts/locale-sync.js.
  // Omitted entirely (not just returning []) under static export — merely
  // defining rewrites() trips Next's "not supported with output: export"
  // warning even when it returns nothing.
  ...(process.env.NEXT_OUTPUT_EXPORT
    ? {}
    : {
        async rewrites() {
          // BACKEND_PORT lets local dev point at a differently-configured
          // backend instance (e.g. a second one on :8000) without editing
          // this file — defaults to the standard port the Python API (and
          // Docker) both use.
          const backendPort = process.env.BACKEND_PORT || 3000;
          return [{ source: "/api/:path*", destination: `http://localhost:${backendPort}/api/:path*` }];
        },
      }),
};

module.exports = nextConfig;
