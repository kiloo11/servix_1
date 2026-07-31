"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// P&L merged into the "Финансы" section as its "Overview" tab — this route
// stays as a redirect so old bookmarks/links keep working.
export default function PnLRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/#overview");
  }, [router]);
  return null;
}
