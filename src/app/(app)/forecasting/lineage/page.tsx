import type { Metadata } from "next";
import { LineageView } from "@/features/governance/lineage-view";

export const metadata: Metadata = { title: "Decision Lineage" };

export default function Page() {
  return <LineageView />;
}
