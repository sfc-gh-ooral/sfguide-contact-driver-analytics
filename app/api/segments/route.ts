import { NextResponse } from "next/server";
import { dataSource } from "@/lib/snowflake";
import { getSegments } from "@/lib/contact-data";

export async function GET() {
  try {
    return NextResponse.json(await getSegments(dataSource));
  } catch (error) {
    console.error("Segments API error:", error);
    return NextResponse.json({ error: "Failed to fetch segments" }, { status: 500 });
  }
}
