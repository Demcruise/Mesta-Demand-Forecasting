import type { Metadata } from "next";
import { QualityView } from "@/features/demand-data/quality-view";

export const metadata: Metadata = { title: "Data quality" };

export default function Page() {
  return <QualityView />;
}
