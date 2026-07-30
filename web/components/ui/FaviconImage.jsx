"use client";

import { useState } from "react";

// Falls back to the initial-letter placeholder not just when faviconUrl is
// empty, but also when it's set but doesn't actually load (wrong/removed
// favicon.ico, unreachable domain, etc.) — a broken image is "no favicon"
// from the user's perspective too. Callers should pass a stable `key` (e.g.
// the favicon URL itself) so switching to a different provider/favicon
// remounts this with fresh error state instead of reusing a stale one.
export default function FaviconImage({ src, letter }) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return <span className="favicon-placeholder">{letter}</span>;
  }
  return <img className="favicon" src={src} alt="" referrerPolicy="no-referrer" onError={() => setErrored(true)} />;
}
