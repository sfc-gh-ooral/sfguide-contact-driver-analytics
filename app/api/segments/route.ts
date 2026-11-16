import { snowflakeSource } from "@/lib/snowflake";
import { getSegments } from "@/lib/contact-data";
import { live } from "@/lib/live-route";

export function GET() {
  return live("Segments", () => getSegments(snowflakeSource));
}
