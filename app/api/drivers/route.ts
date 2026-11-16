import { snowflakeSource } from "@/lib/snowflake";
import { getDrivers, parseDriverFilters } from "@/lib/contact-data";
import { live } from "@/lib/live-route";

export function GET(request: Request) {
  return live("Drivers", () => getDrivers(snowflakeSource, parseDriverFilters(new URL(request.url).searchParams)));
}
