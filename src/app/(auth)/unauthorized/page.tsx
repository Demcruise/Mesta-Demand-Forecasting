import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Access unavailable" };

const COPY: Record<string, { title: string; body: string }> = {
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
};

export default async function UnauthorizedPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const copy = COPY[reason ?? "default"] ?? (COPY.default as { title: string; body: string });
  return (
    <AuthShell>
      <AuthCard title={copy.title} description={copy.body}>
        <Link href="/sign-in" className={buttonVariants({ variant: "primary", size: "lg", className: "w-full" })}>
          Kembali ke halaman masuk
        </Link>
      </AuthCard>
    </AuthShell>
  );
}
