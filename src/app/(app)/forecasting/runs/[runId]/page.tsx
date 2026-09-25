import type { Metadata } from "next";
import { RunDetailView } from "@/features/forecast-runs/run-detail-view";

export async function generateMetadata({ params }: { params: Promise<{ runId: string }> }): Promise<Metadata> {
  const { runId } = await params;
  return { title: decodeURIComponent(runId) };
}

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <RunDetailView runId={decodeURIComponent(runId)} />;
}
