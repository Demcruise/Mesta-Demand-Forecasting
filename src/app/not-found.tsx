import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";

export default function RootNotFound() {
  return (
    <AuthShell>
      <AuthCard title="Page not found" description="The address may be mistyped or out of date.">
        <Link href="/overview" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
          Go to overview
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
