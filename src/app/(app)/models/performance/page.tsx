import type { Metadata } from "next";
import { PerformanceView } from "@/features/models/performance-view";

export const metadata: Metadata = { title: "Model Performance" };

export default function Page() {
  return <PerformanceView />;
}
