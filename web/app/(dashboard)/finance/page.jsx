"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Finance merged into the primary "/" page as tabs alongside Дашборд — this
// route stays as a redirect (preserving any tab hash) so old bookmarks/links
// keep working.
export default function FinanceRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    router.replace(`/${hash}`);
  }, [router]);
  return null;
}
