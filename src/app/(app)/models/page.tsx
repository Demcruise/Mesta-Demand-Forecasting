import type { Metadata } from "next";
import { RegistryView } from "@/features/models/registry-view";

export const metadata: Metadata = { title: "Daftar Model" };

export default function Page() {
  return <RegistryView />;
}
