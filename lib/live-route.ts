// API routes serve Live mode only (Sample mode runs in the browser). Errors are returned, never replaced by sample data.
import { NextResponse } from "next/server";
import { isConfigured } from "./snowflake";

export async function live<T>(name: string, run: () => Promise<T>) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Live mode needs a Snowflake connection. Add the SNOWFLAKE_* settings to .env.local (see .env.example) and restart the app." },
      { status: 503 },
    );
  }
  try {
    return NextResponse.json(await run());
  } catch (error) {
    console.error(`${name} API error:`, (error as Error).message);
    return NextResponse.json({ error: `${name} failed in Snowflake: ${(error as Error).message}` }, { status: 500 });
  }
}
