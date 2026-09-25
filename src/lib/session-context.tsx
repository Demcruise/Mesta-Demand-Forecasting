"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { Session, Workspace } from "@/types/domain";
import type { ApiContext } from "@/lib/api/client";
import { recordSessionEvent } from "@/lib/api/governance";
import { writeSessionCookie } from "@/lib/auth/session";
import { workspaceById, WORKSPACES, findUser } from "@/lib/mock/directory";
import { can as canRole, type Permission } from "@/lib/permissions";
import { track } from "@/lib/telemetry";

type SessionContextValue = {
  session: Session;
  workspace: Workspace;
  workspaces: Workspace[];
  ctx: ApiContext;
  can: (permission: Permission) => boolean;
  switchWorkspace: (workspaceId: string) => void;
  signOut: (reason?: "user" | "expired") => void;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ session: initial, children }: { session: Session; children: React.ReactNode }) {
  const [session, setSession] = React.useState(initial);
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspace = workspaceById(session.workspaceId) ?? (WORKSPACES[0] as Workspace);
  const user = findUser(session.userId);
  const workspaces = React.useMemo(() => WORKSPACES.filter((w) => user?.workspaceIds.includes(w.id)), [user]);
  const ctx = React.useMemo<ApiContext>(() => ({ workspaceId: workspace.id, userId: session.userId, role: session.role }), [workspace.id, session.userId, session.role]);

  // Session expiry: route to sign-in with a recovery path instead of failing silently.
  React.useEffect(() => {
    const ms = session.expiresAt - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => {
      writeSessionCookie(null);
      router.replace(`/sign-in?reason=expired&next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }, Math.min(ms, 2_147_000_000));
    return () => clearTimeout(t);
  }, [session.expiresAt, router]);

  const switchWorkspace = React.useCallback(
    (workspaceId: string) => {
      if (workspaceId === session.workspaceId) return;
      const target = workspaceById(workspaceId);
      if (!target || !user?.workspaceIds.includes(workspaceId)) return;
      const from = workspace;
      const next = { ...session, workspaceId };
      writeSessionCookie(next);
      try {
        window.localStorage.setItem("mdf.last-workspace", workspaceId);
      } catch {
        // Non-critical.
      }
      // Invalidate every workspace-scoped cache so nothing from A leaks into B.
      queryClient.clear();
      setSession(next);
      recordSessionEvent({ workspaceId, userId: session.userId, role: session.role }, "workspace_switch", {
        from: `${from.name} · ${from.environment}`,
        to: `${target.name} · ${target.environment}`,
      });
      track("workspace_switched", { to: workspaceId });
      // Reset scoped filters and selected entities: land on the section root without query params.
      const section = window.location.pathname.split("/").filter(Boolean)[0] ?? "overview";
      const safeRoots = ["overview", "forecasting", "demand-data", "models", "scenarios", "planning", "monitoring", "administration"];
      const root = safeRoots.includes(section) ? section : "overview";
      const landing = root === "forecasting" ? "/forecasting/runs" : root === "demand-data" ? "/demand-data/quality" : root === "administration" ? "/administration/audit" : `/${root}`;
      router.push(landing);
      router.refresh();
    },
    [session, user, workspace, queryClient, router],
  );

  const signOut = React.useCallback(
    (reason: "user" | "expired" = "user") => {
      recordSessionEvent(ctx, "sign_out");
      track("sign_out", {});
      writeSessionCookie(null);
      queryClient.clear();
      router.replace(reason === "expired" ? "/sign-in?reason=expired" : "/signed-out");
    },
    [ctx, queryClient, router],
  );

  const value = React.useMemo<SessionContextValue>(
    () => ({
      session,
      workspace,
      workspaces,
      ctx,
      can: (p) => canRole(session.role, p),
      switchWorkspace,
      signOut,
    }),
    [session, workspace, workspaces, ctx, switchWorkspace, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const v = React.useContext(SessionContext);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}
