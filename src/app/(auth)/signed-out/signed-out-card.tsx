"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-shell";
import { pick } from "@/lib/i18n";

export function SignedOutCard() {
  return (
    <AuthCard
      title={pick("Anda telah keluar", "You have signed out")}
      description={pick(
        "Sesi Mesta Anda di perangkat ini sudah berakhir. Sesi penyedia identitas Anda mungkin masih aktif; keluar juga di sana jika memakai komputer bersama.",
        "Your Mesta session has ended on this device. Your identity provider session may still be active; sign out there too if you use a shared computer.",
      )}
    >
      <Link href="/sign-in" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
        {pick("Masuk kembali", "Sign in again")}
      </Link>
    </AuthCard>
  );
}
