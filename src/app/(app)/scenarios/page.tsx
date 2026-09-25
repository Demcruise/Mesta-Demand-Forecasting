import type { Metadata } from "next";
import { ScenariosView } from "@/features/scenarios/scenarios-view";

export const metadata: Metadata = { title: "Scenarios" };

export default function Page() {
  return <ScenariosView />;
}
