import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Signed out" };

export default function SignedOutPage() {
  return (
    <AuthShell>
      <AuthCard title="Anda telah keluar" description="Sesi Mesta Anda di perangkat ini sudah berakhir. Sesi penyedia identitas Anda mungkin masih aktif; keluar juga di sana jika memakai komputer bersama.">
        <Link href="/sign-in" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
          Masuk kembali
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
