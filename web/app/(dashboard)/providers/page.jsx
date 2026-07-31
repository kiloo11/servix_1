"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { withTrailingSlash } from "../../../lib/navigate";

// Providers merged into the "Ресурсы" section as its "Провайдеры" tab —
// this route stays as a redirect so old bookmarks/links keep working.
export default function ProvidersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(withTrailingSlash("/assets#providers"));
  }, [router]);
  return null;
}
