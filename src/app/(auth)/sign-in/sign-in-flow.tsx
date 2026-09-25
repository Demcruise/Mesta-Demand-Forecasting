"use client";

import { ArrowLeft, Building2, KeyRound, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { ORGANIZATION, PUBLIC_EMAIL_DOMAINS } from "@/lib/mock/directory";
import { safeNextPath } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { InlineAlert } from "@/components/feedback/states";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";

type Step =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "found"; email: string }
  | { kind: "not_found"; domain: string }
  | { kind: "redirecting"; email: string };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * AUTH-001: Work email → organisation discovery → Continue with SSO → IdP (MFA) →
 * callback → session → workspace → role → application. No password creation.
 */
export function SignInFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const reason = params.get("reason");
  const [email, setEmail] = React.useState(params.get("login_hint") ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<Step>({ kind: "idle" });

  const discover = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError("Masukkan email kantor Anda, misalnya nama@perusahaan.com.");
      return;
    }
    const domain = value.split("@")[1] ?? "";
    if (PUBLIC_EMAIL_DOMAINS.includes(domain)) {
      setError("Email pribadi tidak dapat digunakan untuk masuk. Gunakan email yang diberikan organisasi Anda.");
      return;
    }
    setError(null);
    setStep({ kind: "validating" });
    await new Promise((r) => setTimeout(r, 650));
    if (ORGANIZATION.domains.includes(domain)) setStep({ kind: "found", email: value });
    else setStep({ kind: "not_found", domain });
  };

  const continueWithSso = (value: string) => {
    setStep({ kind: "redirecting", email: value });
    const state = crypto.randomUUID();
    try {
      window.sessionStorage.setItem("mdf.sso-state", JSON.stringify({ state, next }));
    } catch {
      // Private mode: the callback falls back to the default landing page.
    }
    const q = new URLSearchParams({ login_hint: value, state, client_id: "mesta-demand-forecasting", redirect_uri: "/auth/callback" });
    setTimeout(() => router.push(`/sign-in/idp?${q.toString()}`), 400);
  };

  return (
    <AuthShell>
      {reason === "expired" && (
        <InlineAlert tone="warning" title="Sesi Anda telah berakhir." className="mb-4">
          Masuk kembali untuk melanjutkan.
        </InlineAlert>
      )}
      {reason === "signed_out" && (
        <InlineAlert tone="success" title="Anda telah keluar." className="mb-4" />
      )}
      {step.kind === "found" || step.kind === "redirecting" ? (
        <AuthCard title="Lanjutkan ke organisasi Anda" description="Organisasi Anda masuk dengan single sign-on.">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-subtle p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="body-sm font-semibold text-fg">{ORGANIZATION.name}</p>
              <p className="truncate caption">{step.email}</p>
              <p className="mt-1 caption">Penyedia identitas: {ORGANIZATION.idp}</p>
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="mt-5 w-full"
            loading={step.kind === "redirecting"}
            loadingText="Mengalihkan ke penyedia identitas"
            onClick={() => continueWithSso(step.email)}
          >
            <KeyRound aria-hidden />
            Lanjutkan dengan SSO
          </Button>
          <p className="mt-3 flex items-start gap-1.5 caption">
            <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
            Autentikasi dua faktor ditangani oleh penyedia identitas Anda.
          </p>
          <Button variant="link" className="mt-4" onClick={() => setStep({ kind: "idle" })} disabled={step.kind === "redirecting"}>
            <ArrowLeft aria-hidden />
            Gunakan email lain
          </Button>
        </AuthCard>
      ) : (
        <AuthCard title="Masuk ke Mesta" description="Masukkan email kantor Anda. Kami akan menemukan organisasi Anda dan mengarahkan ke halaman masuknya.">
          <form onSubmit={discover} noValidate className="flex flex-col gap-4">
            <Field label="Email kantor" htmlFor="email" error={error} hint="Demo: gunakan alamat @mesta.click, misalnya rina.wijaya@mesta.click.">
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                  if (step.kind === "not_found") setStep({ kind: "idle" });
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "email-error" : "email-hint"}
                placeholder="nama@perusahaan.com"
                className="h-[var(--control-h-lg)]"
              />
            </Field>
            {step.kind === "not_found" && (
              <InlineAlert tone="warning" title={`Tidak ada organisasi yang memakai ${step.domain} di Mesta.`}>
                Periksa kembali alamatnya. Jika organisasi Anda baru menggunakan Mesta, minta administrator mendaftarkan domainnya.
              </InlineAlert>
            )}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={step.kind === "validating"} loadingText="Mencari organisasi Anda">
              Lanjutkan ke organisasi
            </Button>
          </form>
        </AuthCard>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {step.kind === "validating" ? "Mencari organisasi Anda" : step.kind === "found" ? `Organisasi ditemukan: ${ORGANIZATION.name}` : step.kind === "redirecting" ? "Mengalihkan ke penyedia identitas" : ""}
      </p>
    </AuthShell>
  );
}
