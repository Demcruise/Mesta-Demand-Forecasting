import type { Metadata } from "next";
import { PlanView } from "@/features/planning/plan-view";

export const metadata: Metadata = { title: "Rencana" };

export default function Page() {
  return <PlanView />;
}
