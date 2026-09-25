import { NextResponse, type NextRequest } from "next/server";
import { decodeSession, isExpired, SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Session guard (AUTH-001): protected routes never render without a session, and
 * the workspace is resolved before any workspace-scoped page renders.
 */

const PUBLIC_PREFIXES = ["/sign-in", "/auth", "/unauthorized", "/signed-out"];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = decodeSession(raw);
  const next = `${pathname}${search}`;
  if (!session) {
    const url = new URL("/sign-in", request.url);
    if (pathname !== "/") url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  if (isExpired(session)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("reason", "expired");
    url.searchParams.set("next", next);
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  if (!session.workspaceId && !pathname.startsWith("/select-workspace")) {
    const url = new URL("/select-workspace", request.url);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|svg|jpg|ico|webp)$).*)"],
};
