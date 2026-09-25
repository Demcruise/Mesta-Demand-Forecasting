import type { Metadata } from "next";
import { ScenariosView } from "@/features/scenarios/scenarios-view";

export const metadata: Metadata = { title: "Skenario" };

export default function Page() {
  return <ScenariosView />;
}
