import { NextResponse } from "next/server";
import { CORTEX_MODEL, isConfigured } from "@/lib/snowflake";

export const dynamic = "force-dynamic";

// Tells the header switch whether Live mode can be offered. Returns no connection details.
export function GET() {
  return NextResponse.json({ configured: isConfigured(), model: CORTEX_MODEL });
}
