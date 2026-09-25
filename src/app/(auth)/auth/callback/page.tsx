"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Suspense } from "react";
import type { Session } from "@/types/domain";
import { recordSessionEvent } from "@/lib/api/governance";
import { safeNextPath, writeSessionCookie } from "@/lib/auth/session";
import { findUser, ORGANIZATION } from "@/lib/mock/directory";
import { track } from "@/lib/telemetry";
import { buttonVariants } from "@/components/ui/button";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { InlineAlert } from "@/components/feedback/states";
import { pick } from "@/lib/i18n";

const SESSION_HOURS = 12;
const LAST_WORKSPACE_KEY = "mdf.last-workspace";

type Status = { kind: "processing"; message: string } | { kind: "error"; title: string; detail: string };

/** AuthCallback: validates state, exchanges the code, resolves workspace and role. */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = React.useState<Status>({ kind: "processing", message: pick("Memverifikasi proses masuk Anda", "Verifying your sign-in") });
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get("code") ?? "";
    const state = params.get("state") ?? "";
    let expected: { state: string; next: string } | null = null;
    try {
      expected = JSON.parse(window.sessionStorage.getItem("mdf.sso-state") ?? "null");
      window.sessionStorage.removeItem("mdf.sso-state");
    } catch {
      expected = null;
    }
    if (!expected || expected.state !== state) {
      setStatus({ kind: "error", title: pick("Tautan masuk ini sudah tidak berlaku.", "This sign-in link is no longer valid."), detail: pick("Permintaan masuk sudah kedaluwarsa atau dimulai di tab lain. Mulai lagi dari halaman masuk.", "The sign-in request expired or was started in another browser tab. Start again from the sign-in page.") });
      return;
    }
    const user = findUser(code.replace(/^demo_/, ""));
    if (!user) {
      setStatus({ kind: "error", title: pick("Penyedia identitas tidak mengembalikan akun yang dikenali.", "Your identity provider did not return a known account."), detail: pick("Hubungi administrator ruang kerja Anda agar ditambahkan ke Mesta.", "Contact your workspace administrator to be added to Mesta.") });
      return;
    }
    if (user.status === "suspended") {
      router.replace("/unauthorized?reason=disabled");
      return;
    }
    if (user.workspaceIds.length === 0) {
      router.replace("/unauthorized?reason=no-workspace");
      return;
    }
    setStatus({ kind: "processing", message: pick("Menentukan ruang kerja dan peran Anda", "Resolving your workspace and role") });
    let last: string | null = null;
    try {
      last = window.localStorage.getItem(LAST_WORKSPACE_KEY);
    } catch {
      last = null;
    }
    const workspaceId = user.workspaceIds.length === 1 ? (user.workspaceIds[0] as string) : last && user.workspaceIds.includes(last) ? last : null;
    const now = Date.now();
    const session: Session = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      workspaceId,
      organization: ORGANIZATION.name,
      idp: ORGANIZATION.idp,
      issuedAt: now,
      expiresAt: now + SESSION_HOURS * 3_600_000,
    };
    writeSessionCookie(session);
    track("sign_in", { role: user.role });
    const next = safeNextPath(expected.next);
    setTimeout(() => {
      if (workspaceId) {
        recordSessionEvent({ workspaceId, userId: user.id, role: user.role }, "sign_in");
        router.replace(next);
      } else {
        router.replace(`/select-workspace?next=${encodeURIComponent(next)}`);
      }
    }, 450);
  }, [params, router]);

  return (
    <AuthShell>
      {status.kind === "processing" ? (
        <AuthCard title={pick("Memasukkan Anda", "Signing you in")}>
          <div className="flex items-center gap-3" role="status" aria-live="polite">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            <span className="body text-fg-secondary">{status.message}…</span>
          </div>
        </AuthCard>
      ) : (
        <AuthCard title={pick("Proses masuk tidak dapat diselesaikan", "Sign-in could not be completed")}>
          <InlineAlert tone="critical" title={status.title}>
            {status.detail}
          </InlineAlert>
          <Link href="/sign-in" className={buttonVariants({ variant: "primary", size: "lg", className: "mt-5 w-full" })}>
            {pick("Kembali ke halaman masuk", "Back to sign in")}
          </Link>
        </AuthCard>
      )}
    </AuthShell>
  );
}

export default function CallbackPage() {
  return (
    <Suspense>
      <Callback />
    </Suspense>
  );
}
