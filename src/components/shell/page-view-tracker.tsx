"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import { track } from "@/lib/telemetry";

/**
 * Emits `page_view` for each route change inside the application shell. Kept separate
 * from the shell so navigation telemetry has one owner and never fires on public routes.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  React.useEffect(() => {
    track("page_view", { path: pathname });
  }, [pathname]);
  return null;
}
