"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard } from "@/components/auth/auth-shell";
import { localized, pick } from "@/lib/i18n";

const COPY: Record<string, { title: string; body: string }> = localized(
  {
    disabled: {
      title: "Akun Anda dinonaktifkan",
      body: "Organisasi Anda menangguhkan akses ke Mesta untuk akun ini. Jika menurut Anda ini keliru, hubungi administrator ruang kerja Anda.",
    },
    "no-workspace": {
      title: "Anda belum memiliki ruang kerja",
      body: "Akun Anda ada, tetapi belum ditambahkan ke ruang kerja. Minta administrator ruang kerja mengundang Anda.",
    },
    default: {
      title: "Anda tidak memiliki akses",
      body: "Akun Anda tidak diizinkan membuka halaman ini. Hubungi administrator ruang kerja jika Anda memerlukan akses.",
    },
  },
  {
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
  },
);

export function UnauthorizedCard({ reason }: { reason?: string }) {
  const copy = COPY[reason ?? "default"] ?? (COPY.default as { title: string; body: string });
  return (
    <AuthCard title={copy.title} description={copy.body}>
      <Link href="/sign-in" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
        {pick("Kembali ke halaman masuk", "Back to sign in")}
      </Link>
    </AuthCard>
  );
}
