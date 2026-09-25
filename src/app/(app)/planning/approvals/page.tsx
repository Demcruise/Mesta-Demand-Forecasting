import type { Metadata } from "next";
import { ApprovalsView } from "@/features/approvals/approvals-view";

export const metadata: Metadata = { title: "Persetujuan" };

export default function Page() {
  return <ApprovalsView />;
}
