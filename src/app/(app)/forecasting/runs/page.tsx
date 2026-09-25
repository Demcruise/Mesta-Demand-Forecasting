import type { Metadata } from "next";
import { RunsView } from "@/features/forecast-runs/runs-view";

export const metadata: Metadata = { title: "Forecast Runs" };

export default function RunsPage() {
  return <RunsView />;
}
