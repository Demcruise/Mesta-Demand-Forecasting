"use client";

import { ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Suspense } from "react";
import { recordSessionEvent } from "@/lib/api/governance";
import { decodeSession, safeNextPath, SESSION_COOKIE, writeSessionCookie } from "@/lib/auth/session";
import { findUser, WORKSPACES } from "@/lib/mock/directory";
import { ROLE_LABELS } from "@/lib/permissions";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { Tag } from "@/components/feedback/status";

function readSession() {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return decodeSession(raw);
}

/** Workspace resolution after sign-in when the user belongs to several workspaces. */
function SelectWorkspace() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [session, setSession] = React.useState<ReturnType<typeof readSession>>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/sign-in?reason=expired");
      return;
    }
    setSession(s);
    setReady(true);
  }, [router]);

  if (!ready || !session) return <AuthShell>{null}</AuthShell>;
  const user = findUser(session.userId);
  const workspaces = WORKSPACES.filter((w) => user?.workspaceIds.includes(w.id));

  const choose = (workspaceId: string) => {
    const nextSession = { ...session, workspaceId };
    writeSessionCookie(nextSession);
    try {
      window.localStorage.setItem("mdf.last-workspace", workspaceId);
    } catch {
      // Non-critical.
    }
    recordSessionEvent({ workspaceId, userId: session.userId, role: session.role }, "sign_in");
    router.replace(next);
    router.refresh();
  };

  return (
    <AuthShell>
      <AuthCard title="Choose a workspace" description={`Signed in as ${session.email}. You can switch workspace later from the sidebar.`}>
        <ul className="flex flex-col gap-2">
          {workspaces.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => choose(w.id)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-fg" aria-hidden>
                  {w.name.slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="body-sm font-semibold text-fg">{w.name}</span>
                    <Tag tone={w.environment === "Production" ? "primary" : w.environment === "Staging" ? "info" : "neutral"}>{w.environment}</Tag>
                    {w.status !== "active" && <Tag tone="warning">{w.status === "degraded" ? "Degraded" : "Maintenance"}</Tag>}
                  </span>
                  <span className="caption">
                    {w.region} · Your role: {ROLE_LABELS[session.role]}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </AuthCard>
    </AuthShell>
  );
}

export default function SelectWorkspacePage() {
  return (
    <Suspense>
      <SelectWorkspace />
    </Suspense>
  );
}
