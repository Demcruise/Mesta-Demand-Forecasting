import type { Metadata } from "next";
import { PlanView } from "@/features/planning/plan-view";

export const metadata: Metadata = { title: "Plan Workspace" };

export default function Page() {
  return <PlanView />;
}
