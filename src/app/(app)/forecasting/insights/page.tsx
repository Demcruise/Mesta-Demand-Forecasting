import type { Metadata } from "next";
import { ForecastInsightsView } from "@/features/analytics/insights-view";

export const metadata: Metadata = { title: "Forecast insights" };

export default function Page() {
  return <ForecastInsightsView />;
}
