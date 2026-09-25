import type { Metadata } from "next";
import { ScenarioDetailView } from "@/features/scenarios/scenario-detail-view";

export const metadata: Metadata = { title: "Scenario" };

export default async function ScenarioPage({ params }: { params: Promise<{ scenarioId: string }> }) {
  const { scenarioId } = await params;
  return <ScenarioDetailView scenarioId={decodeURIComponent(scenarioId)} />;
}
