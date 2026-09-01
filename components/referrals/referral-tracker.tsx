"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { captureReferral } from "@/lib/referrals/client";

export function ReferralTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const referralId = searchParams.get("ref");

  useEffect(() => {
    if (!referralId) return;
    void captureReferral(referralId, pathname);
  }, [pathname, referralId]);

  return null;
}
