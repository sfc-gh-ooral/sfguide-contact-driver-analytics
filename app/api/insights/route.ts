import { liveInsight, snowflakeSource } from "@/lib/snowflake";
import { getInsightStats, parseTimeframe } from "@/lib/contact-data";
import { live } from "@/lib/live-route";

// Aggregates V_CALL_DRIVER_ANALYSIS and CALL_TRANSCRIPTS, then calls AI_COMPLETE on the totals.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const lob = typeof body.segment === "string" ? body.segment : undefined;
  return live("AI insights", async () => liveInsight(await getInsightStats(snowflakeSource, lob, parseTimeframe(body.timeframe))));
}
