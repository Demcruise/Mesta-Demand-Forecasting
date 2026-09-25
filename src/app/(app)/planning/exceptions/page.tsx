import type { Metadata } from "next";
import { ExceptionsView } from "@/features/exceptions/exceptions-view";

export const metadata: Metadata = { title: "Exceptions" };

export default function Page() {
  return <ExceptionsView />;
}
