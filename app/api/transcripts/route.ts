import { NextRequest, NextResponse } from "next/server";
import { dataSource } from "@/lib/snowflake";
import { getTranscripts, parseTranscriptFilters } from "@/lib/contact-data";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(await getTranscripts(dataSource, parseTranscriptFilters(request.nextUrl.searchParams)));
  } catch (error) {
    console.error("Error fetching transcripts:", error);
    return NextResponse.json([]);
  }
}
