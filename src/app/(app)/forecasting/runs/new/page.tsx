import type { Metadata } from "next";
import { CreateRunView } from "@/features/forecast-runs/create-run-view";

export const metadata: Metadata = { title: "Buat Perkiraan" };

export default function NewRunPage() {
  return <CreateRunView />;
}
