import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignedOutCard } from "./signed-out-card";

export const metadata: Metadata = { title: "Signed out" };

export default function SignedOutPage() {
  return (
    <AuthShell>
      <SignedOutCard />
    </AuthShell>
  );
}
