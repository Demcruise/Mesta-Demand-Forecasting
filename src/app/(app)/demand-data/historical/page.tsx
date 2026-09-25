import type { Metadata } from "next";
import { HistoricalView } from "@/features/demand-data/historical-view";

export const metadata: Metadata = { title: "Historical demand" };

export default function Page() {
  return <HistoricalView />;
}
