import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { pick } from "@/lib/i18n/core";

export default function RootNotFound() {
  return (
    <AuthShell>
      <AuthCard title={pick("Halaman tidak ditemukan", "Page not found")} description={pick("Alamatnya mungkin salah ketik atau sudah usang.", "The address may be mistyped or out of date.")}>
        <Link href="/overview" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
          {pick("Ke Ringkasan", "Go to overview")}
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
