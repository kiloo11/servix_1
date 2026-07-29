"use client";

import { useEffect, useState } from "react";

// Mirrors a CSS media query in JS — needed where a component's own logic
// (not just its styling) has to differ between desktop/mobile, e.g. Sidebar
// deciding whether nav-item tooltips should be active at all (the desktop
// icon-only collapsed sidebar needs them; the mobile overlay never should,
// regardless of what the desktop `collapsed` preference happens to be).
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (event) => setMatches(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
