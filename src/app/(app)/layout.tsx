import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { decodeSession, isExpired, SESSION_COOKIE } from "@/lib/auth/session";
import { findUser, workspaceById } from "@/lib/mock/directory";
import { SessionProvider } from "@/lib/session-context";

/**
 * SessionGuard for every protected route: the session, workspace and role are
 * resolved on the server before any application data renders (AUTH-001).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const session = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (!session || isExpired(session)) redirect("/sign-in?reason=expired");
  const user = findUser(session.userId);
  if (!user || user.status === "suspended") redirect("/unauthorized?reason=disabled");
  if (!session.workspaceId || !workspaceById(session.workspaceId) || !user.workspaceIds.includes(session.workspaceId)) {
    redirect("/select-workspace");
  }
  return (
    <SessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
