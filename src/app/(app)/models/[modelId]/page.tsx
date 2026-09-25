import type { Metadata } from "next";
import { ModelDetailView } from "@/features/models/model-detail-view";

export const metadata: Metadata = { title: "Model" };

export default async function ModelPage({ params }: { params: Promise<{ modelId: string }> }) {
  const { modelId } = await params;
  return <ModelDetailView modelId={decodeURIComponent(modelId)} />;
}
