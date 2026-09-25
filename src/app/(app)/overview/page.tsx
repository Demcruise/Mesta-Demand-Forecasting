import type { Metadata } from "next";
import { OverviewView } from "@/features/overview/overview-view";

export const metadata: Metadata = { title: "Ringkasan" };

export default function OverviewPage() {
  return <OverviewView />;
}
