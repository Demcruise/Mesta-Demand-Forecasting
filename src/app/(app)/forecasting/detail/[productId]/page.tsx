import type { Metadata } from "next";
import { ForecastDetailView } from "@/features/forecast-detail/forecast-detail-view";

export const metadata: Metadata = { title: "Detail Perkiraan" };

export default async function ForecastDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  return <ForecastDetailView productId={decodeURIComponent(productId)} />;
}
