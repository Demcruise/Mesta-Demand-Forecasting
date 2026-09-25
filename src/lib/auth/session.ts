import type { Role, Session } from "@/types/domain";

/**
 * Demo session transport.
 *
 * The session is a base64url JSON cookie written by the demo SSO callback. It is NOT
 * signed or encrypted and must not be used in production: replace it with an
 * httpOnly session issued by the backend after the OIDC/SAML callback (AUTH-001).
 */

export const SESSION_COOKIE = "mdf_session";

const ROLES: Role[] = ["viewer", "planner", "manager", "analyst", "admin"];

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeSession(session: Session) {
  return toBase64Url(JSON.stringify(session));
}

export function decodeSession(raw: string | undefined | null): Session | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(fromBase64Url(raw)) as Partial<Session>;
    if (
      typeof s.userId !== "string" ||
      typeof s.email !== "string" ||
      typeof s.name !== "string" ||
      !ROLES.includes(s.role as Role) ||
      typeof s.expiresAt !== "number" ||
      typeof s.issuedAt !== "number"
    ) {
      return null;
    }
    return {
      userId: s.userId,
      email: s.email,
      name: s.name,
      role: s.role as Role,
      workspaceId: typeof s.workspaceId === "string" ? s.workspaceId : null,
      organization: s.organization ?? "",
      idp: s.idp ?? "",
      issuedAt: s.issuedAt,
      expiresAt: s.expiresAt,
    };
  } catch {
    return null;
  }
}

export function isExpired(session: Session, now = Date.now()) {
  return session.expiresAt <= now;
}

/** Client-side cookie write (demo only; production sessions are httpOnly). */
export function writeSessionCookie(session: Session | null) {
  if (typeof document === "undefined") return;
  if (!session) {
    document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }
  const maxAge = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  document.cookie = `${SESSION_COOKIE}=${encodeSession(session)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

export function safeNextPath(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/overview";
  if (next.startsWith("/sign-in") || next.startsWith("/auth")) return "/overview";
  return next;
}
