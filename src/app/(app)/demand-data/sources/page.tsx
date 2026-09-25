import type { Metadata } from "next";
import { SourcesView } from "@/features/demand-data/sources-view";

export const metadata: Metadata = { title: "Data Sources" };

export default function Page() {
  return <SourcesView mode="data" />;
}
