import { NextResponse } from "next/server";
import { dataSource } from "@/lib/snowflake";
import { getInsights, parseTimeframe } from "@/lib/contact-data";

export async function POST(request: Request) {
  try {
    const { segment, timeframe } = await request.json();
    const lob = typeof segment === "string" ? segment : undefined;
    return NextResponse.json(await getInsights(dataSource, lob, parseTimeframe(timeframe)));
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
