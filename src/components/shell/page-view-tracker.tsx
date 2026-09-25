"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import { useI18n } from "@/lib/i18n";
import { track } from "@/lib/telemetry";
import { SEGMENT_LABELS } from "./nav-config";

/**
 * Emits `page_view` for each route change inside the application shell. Kept separate
 * from the shell so navigation telemetry has one owner and never fires on public routes.
 * Also keeps document.title in the active locale — static metadata can only serve one
 * language, so the client takes over after hydration.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const { locale } = useI18n();
  React.useEffect(() => {
    track("page_view", { path: pathname });
  }, [pathname]);
  React.useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const lastKnown = [...segments].reverse().find((s) => s in SEGMENT_LABELS);
    document.title = lastKnown ? `${SEGMENT_LABELS[lastKnown]} · Mesta Demand Forecasting` : "Mesta Demand Forecasting";
  }, [pathname, locale]);
  return null;
}
