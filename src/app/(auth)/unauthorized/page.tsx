import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Access unavailable" };

const COPY: Record<string, { title: string; body: string }> = {
  disabled: {
    title: "Your account is disabled",
    body: "Your organisation has suspended access to Mesta for this account. If you think this is a mistake, contact your workspace administrator.",
  },
  "no-workspace": {
    title: "You have no workspace yet",
    body: "Your account exists but has not been added to a workspace. Ask your workspace administrator to invite you.",
  },
  default: {
    title: "You do not have access",
    body: "Your account is not permitted to open this page. Contact your workspace administrator if you need access.",
  },
};

export default async function UnauthorizedPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const copy = COPY[reason ?? "default"] ?? (COPY.default as { title: string; body: string });
  return (
    <AuthShell>
      <AuthCard title={copy.title} description={copy.body}>
        <Link href="/sign-in" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
          Return to sign in
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
