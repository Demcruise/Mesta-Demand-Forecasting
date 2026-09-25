import type { Metadata } from "next";
import { HistoricalView } from "@/features/demand-data/historical-view";

export const metadata: Metadata = { title: "Permintaan Historis" };

export default function Page() {
  return <HistoricalView />;
}
