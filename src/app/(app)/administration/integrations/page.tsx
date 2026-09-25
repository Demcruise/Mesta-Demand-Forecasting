import type { Metadata } from "next";
import { SourcesView } from "@/features/demand-data/sources-view";

export const metadata: Metadata = { title: "Integrations" };

export default function Page() {
  return <SourcesView mode="admin" />;
}
