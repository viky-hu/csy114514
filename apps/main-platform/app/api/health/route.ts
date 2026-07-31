import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "main-platform",
    boundary: "bff",
    timestamp: new Date().toISOString()
  });
}
