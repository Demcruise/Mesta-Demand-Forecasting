import type { Metadata } from "next";
import { RegistryView } from "@/features/models/registry-view";

export const metadata: Metadata = { title: "Model Registry" };

export default function Page() {
  return <RegistryView />;
}
