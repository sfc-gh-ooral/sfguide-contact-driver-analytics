import { snowflakeSource } from "@/lib/snowflake";
import { getTrends } from "@/lib/contact-data";
import { live } from "@/lib/live-route";

export function GET() {
  return live("Trends", () => getTrends(snowflakeSource));
}
