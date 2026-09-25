import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Signed out" };

export default function SignedOutPage() {
  return (
    <AuthShell>
      <AuthCard title="You have signed out" description="Your Mesta session has ended on this device. Your identity provider session may still be active; sign out there too if you use a shared computer.">
        <Link href="/sign-in" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
          Sign in again
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
