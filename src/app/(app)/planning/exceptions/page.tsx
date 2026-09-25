import type { Metadata } from "next";
import { ExceptionsView } from "@/features/exceptions/exceptions-view";

export const metadata: Metadata = { title: "Perlu Ditinjau" };

export default function Page() {
  return <ExceptionsView />;
}
