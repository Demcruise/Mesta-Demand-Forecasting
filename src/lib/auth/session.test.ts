import { describe, expect, it } from "vitest";
import type { Session } from "@/types/domain";
import { decodeSession, encodeSession, isExpired, safeNextPath } from "./session";

const session: Session = {
  userId: "u_rina",
  name: "Rina Wijaya",
  email: "rina.wijaya@mesta.click",
  role: "planner",
  workspaceId: "ws_retail_prod",
  organization: "Mesta Retail Group",
  idp: "Demo IdP",
  issuedAt: 1_000,
  expiresAt: 2_000,
};

describe("session transport", () => {
  it("round-trips a session", () => {
    expect(decodeSession(encodeSession(session))).toEqual(session);
  });

  it("rejects malformed or tampered payloads", () => {
    expect(decodeSession("not-base64!!")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
    const tampered = encodeSession({ ...session, role: "superuser" as never });
    expect(decodeSession(tampered)).toBeNull();
  });

  it("detects expiry", () => {
    expect(isExpired(session, 1_500)).toBe(false);
    expect(isExpired(session, 2_000)).toBe(true);
  });

  it("only allows same-origin relative redirects", () => {
    expect(safeNextPath("/planning?x=1")).toBe("/planning?x=1");
    expect(safeNextPath("https://evil.example")).toBe("/overview");
    expect(safeNextPath("//evil.example")).toBe("/overview");
    expect(safeNextPath("/sign-in")).toBe("/overview");
    expect(safeNextPath(null)).toBe("/overview");
  });
});
