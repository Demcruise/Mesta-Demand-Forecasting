import type { Metadata } from "next";
import { RunsView } from "@/features/forecast-runs/runs-view";

export const metadata: Metadata = { title: "Proses Perkiraan" };

export default function RunsPage() {
  return <RunsView />;
}
