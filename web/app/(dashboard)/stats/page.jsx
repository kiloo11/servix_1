"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Stats merged into the "Финансы" section as its "Payments" tab — this route
// stays as a redirect so old bookmarks/links keep working.
export default function StatsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/#payments");
  }, [router]);
  return null;
}
