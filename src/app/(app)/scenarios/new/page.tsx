import type { Metadata } from "next";
import { NewScenarioView } from "@/features/scenarios/new-scenario-view";

export const metadata: Metadata = { title: "Buat Skenario" };

export default function Page() {
  return <NewScenarioView />;
}
