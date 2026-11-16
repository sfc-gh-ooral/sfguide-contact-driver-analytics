import { NextRequest } from "next/server";
import { snowflakeSource } from "@/lib/snowflake";
import { getTranscripts, parseTranscriptFilters } from "@/lib/contact-data";
import { live } from "@/lib/live-route";

export function GET(request: NextRequest) {
  return live("Transcripts", () => getTranscripts(snowflakeSource, parseTranscriptFilters(request.nextUrl.searchParams)));
}
