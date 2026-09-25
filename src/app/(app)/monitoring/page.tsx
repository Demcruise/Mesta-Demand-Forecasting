import type { Metadata } from "next";
import { MonitoringView } from "@/features/monitoring/monitoring-view";

export const metadata: Metadata = { title: "Pemantauan" };

export default function Page() {
  return <MonitoringView />;
}
