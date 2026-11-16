import { NextResponse } from "next/server";
import { dataSource } from "@/lib/snowflake";
import { getTrends } from "@/lib/contact-data";

export async function GET() {
  try {
    return NextResponse.json(await getTrends(dataSource));
  } catch (error) {
    console.error("Trends API error:", error);
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
