import { NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

interface TrendRow {
  WEEK_START: string;
  TOTAL_CALLS: number;
  OVERALL_SENTIMENT: number;
  TOTAL_ESCALATIONS: number;
  ESCALATION_RATE: number;
  AVG_CALL_DURATION_SEC: number;
}

export async function GET() {
  try {
    const results = await query<TrendRow>(`
      SELECT * FROM CONTACT_ANALYTICS.ANALYTICS.V_TREND_SUMMARY
      ORDER BY WEEK_START DESC
      LIMIT 13
    `);
    return NextResponse.json(results.reverse());
  } catch (error) {
    console.error("Trends API error:", error);
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
