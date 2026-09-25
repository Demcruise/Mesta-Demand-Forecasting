import type { Metadata } from "next";
import { CompareView } from "@/features/scenarios/compare-view";

export const metadata: Metadata = { title: "Scenario comparison" };

export default function Page() {
  return <CompareView />;
}
