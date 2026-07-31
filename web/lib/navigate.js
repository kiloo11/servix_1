// Production is a static export with trailingSlash:true (next.config.js),
// exporting each route as <route>/index.html — the real, canonical URL for
// e.g. "/assets" is "/assets/". next/link normalizes hrefs against this
// automatically, but router.push()/router.replace() (used everywhere we
// need onClick side effects alongside navigation, or a redirect) don't —
// a bare path resolves to nothing in the export's route manifest, and the
// router silently falls back to a full hard navigation (reload + re-run the
// whole auth/data bootstrap) instead of an instant client-side transition.
export function withTrailingSlash(path) {
  const hashIndex = path.indexOf("#");
  const pathname = hashIndex === -1 ? path : path.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : path.slice(hashIndex);
  return (pathname.endsWith("/") ? pathname : `${pathname}/`) + hash;
}
