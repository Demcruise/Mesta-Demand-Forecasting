import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { UnauthorizedCard } from "./unauthorized-card";

export const metadata: Metadata = { title: "Access unavailable" };

export default async function UnauthorizedPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <AuthShell>
      <UnauthorizedCard reason={reason} />
    </AuthShell>
  );
}
