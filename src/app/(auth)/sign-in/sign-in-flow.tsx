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
import { pick } from "@/lib/i18n";

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
      setError(pick("Masukkan email kantor Anda, misalnya nama@perusahaan.com.", "Enter your work email address, for example name@company.com."));
      return;
    }
    const domain = value.split("@")[1] ?? "";
    if (PUBLIC_EMAIL_DOMAINS.includes(domain)) {
      setError(pick("Email pribadi tidak dapat digunakan untuk masuk. Gunakan email yang diberikan organisasi Anda.", "Personal email addresses cannot sign in. Use the email address your organisation gave you."));
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
        <InlineAlert tone="warning" title={pick("Sesi Anda telah berakhir.", "Your session has ended.")} className="mb-4">
          {pick("Masuk kembali untuk melanjutkan.", "Sign in again to continue.")}
        </InlineAlert>
      )}
      {reason === "signed_out" && (
        <InlineAlert tone="success" title={pick("Anda telah keluar.", "You have signed out.")} className="mb-4" />
      )}
      {step.kind === "found" || step.kind === "redirecting" ? (
        <AuthCard title={pick("Lanjutkan ke organisasi Anda", "Continue to your organisation")} description={pick("Organisasi Anda masuk dengan single sign-on.", "Your organisation signs in with single sign-on.")}>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-subtle p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-fg">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="body-sm font-semibold text-fg">{ORGANIZATION.name}</p>
              <p className="truncate caption">{step.email}</p>
              <p className="mt-1 caption">
                {pick("Penyedia identitas", "Identity provider")}: {ORGANIZATION.idp}
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="mt-5 w-full"
            loading={step.kind === "redirecting"}
            loadingText={pick("Mengalihkan ke penyedia identitas", "Redirecting to identity provider")}
            onClick={() => continueWithSso(step.email)}
          >
            <KeyRound aria-hidden />
            {pick("Lanjutkan dengan SSO", "Continue with SSO")}
          </Button>
          <p className="mt-3 flex items-start gap-1.5 caption">
            <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
            {pick("Autentikasi dua faktor ditangani oleh penyedia identitas Anda.", "Two-factor authentication is handled by your identity provider.")}
          </p>
          <Button variant="link" className="mt-4" onClick={() => setStep({ kind: "idle" })} disabled={step.kind === "redirecting"}>
            <ArrowLeft aria-hidden />
            {pick("Gunakan email lain", "Use a different email")}
          </Button>
        </AuthCard>
      ) : (
        <AuthCard title={pick("Masuk ke Mesta", "Sign in to Mesta")} description={pick("Masukkan email kantor Anda. Kami akan menemukan organisasi Anda dan mengarahkan ke halaman masuknya.", "Enter your work email. We will find your organisation and send you to its sign-in page.")}>
          <form onSubmit={discover} noValidate className="flex flex-col gap-4">
            <Field label={pick("Email kantor", "Work email")} htmlFor="email" error={error} hint={pick("Demo: gunakan alamat @mesta.click, misalnya rina.wijaya@mesta.click.", "Demo: use an address at mesta.click, for example rina.wijaya@mesta.click.")}>
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
                placeholder={pick("nama@perusahaan.com", "name@company.com")}
                className="h-[var(--control-h-lg)]"
              />
            </Field>
            {step.kind === "not_found" && (
              <InlineAlert tone="warning" title={pick(`Tidak ada organisasi yang memakai ${step.domain} di Mesta.`, `No organisation uses ${step.domain} with Mesta.`)}>
                {pick("Periksa kembali alamatnya. Jika organisasi Anda baru menggunakan Mesta, minta administrator mendaftarkan domainnya.", "Check the address. If your organisation is new to Mesta, ask an administrator to register its domain.")}
              </InlineAlert>
            )}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={step.kind === "validating"} loadingText={pick("Mencari organisasi Anda", "Finding your organisation")}>
              {pick("Lanjutkan ke organisasi", "Continue to organisation")}
            </Button>
          </form>
        </AuthCard>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {step.kind === "validating" ? pick("Mencari organisasi Anda", "Finding your organisation") : step.kind === "found" ? pick(`Organisasi ditemukan: ${ORGANIZATION.name}`, `Organisation found: ${ORGANIZATION.name}`) : step.kind === "redirecting" ? pick("Mengalihkan ke penyedia identitas", "Redirecting to identity provider") : ""}
      </p>
    </AuthShell>
  );
}
