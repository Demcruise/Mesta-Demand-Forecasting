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

const SESSION_HOURS = 12;
const LAST_WORKSPACE_KEY = "mdf.last-workspace";

type Status = { kind: "processing"; message: string } | { kind: "error"; title: string; detail: string };

/** AuthCallback: validates state, exchanges the code, resolves workspace and role. */
function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = React.useState<Status>({ kind: "processing", message: "Memverifikasi proses masuk Anda" });
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
      setStatus({ kind: "error", title: "Tautan masuk ini sudah tidak berlaku.", detail: "Permintaan masuk sudah kedaluwarsa atau dimulai di tab lain. Mulai lagi dari halaman masuk." });
      return;
    }
    const user = findUser(code.replace(/^demo_/, ""));
    if (!user) {
      setStatus({ kind: "error", title: "Penyedia identitas tidak mengembalikan akun yang dikenali.", detail: "Hubungi administrator ruang kerja Anda agar ditambahkan ke Mesta." });
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
    setStatus({ kind: "processing", message: "Menentukan ruang kerja dan peran Anda" });
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
        <AuthCard title="Memasukkan Anda">
          <div className="flex items-center gap-3" role="status" aria-live="polite">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
            <span className="body text-fg-secondary">{status.message}…</span>
          </div>
        </AuthCard>
      ) : (
        <AuthCard title="Proses masuk tidak dapat diselesaikan">
          <InlineAlert tone="critical" title={status.title}>
            {status.detail}
          </InlineAlert>
          <Link href="/sign-in" className={buttonVariants({ variant: "primary", size: "lg", className: "mt-5 w-full" })}>
            Kembali ke halaman masuk
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
