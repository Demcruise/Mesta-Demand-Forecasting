import { NextResponse } from "next/server";

/**
 * Telemetry collector stub (backlog §72). The demo has no analytics backend, so this
 * route accepts a batch, validates its shape and discards it — it exists so the client
 * transport has a real destination and the delivery path can be exercised end to end.
 *
 * Replace the body with a forward to the real collector. Do not log payloads: events
 * are deliberately non-sensitive, but logging them would still create a copy.
 */

const MAX_BATCH = 200;

type IncomingRecord = { event?: unknown; props?: unknown; at?: unknown };

export async function POST(request: Request) {
  let accepted = 0;
  try {
    const body = (await request.json()) as { records?: unknown };
    if (Array.isArray(body?.records)) {
      accepted = body.records.filter((r): r is IncomingRecord => !!r && typeof r === "object" && typeof (r as IncomingRecord).event === "string").length;
      accepted = Math.min(accepted, MAX_BATCH);
    }
  } catch {
    return NextResponse.json({ accepted: 0 }, { status: 400 });
  }
  return NextResponse.json({ accepted }, { headers: { "cache-control": "no-store" } });
}
