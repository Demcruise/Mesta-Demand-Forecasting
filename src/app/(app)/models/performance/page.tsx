import type { Metadata } from "next";
import { PerformanceView } from "@/features/models/performance-view";

export const metadata: Metadata = { title: "Performa Model" };

export default function Page() {
  return <PerformanceView />;
}
