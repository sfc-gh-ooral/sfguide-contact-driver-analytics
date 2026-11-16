import { NextResponse } from "next/server";
import { dataSource } from "@/lib/snowflake";
import { getDrivers, parseDriverFilters } from "@/lib/contact-data";

export async function GET(request: Request) {
  try {
    const filters = parseDriverFilters(new URL(request.url).searchParams);
    return NextResponse.json(await getDrivers(dataSource, filters));
  } catch (error) {
    console.error("Drivers API error:", error);
    return NextResponse.json({ error: "Failed to fetch drivers" }, { status: 500 });
  }
}
